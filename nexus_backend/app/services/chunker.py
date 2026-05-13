"""
Text chunker — splits extracted document text into overlapping chunks.

Uses recursive character splitting: tries to split on paragraph boundaries
first, then sentences, then words, to keep chunks semantically coherent.
"""

from dataclasses import dataclass

from app.core.config import get_settings


@dataclass
class Chunk:
    """A single text chunk with metadata."""
    text: str
    file_path: str
    chunk_index: int
    total_chunks: int


# Split hierarchy: try paragraph breaks first, then lines, sentences, words
_SEPARATORS = ["\n\n", "\n", ". ", " "]


def _split_text(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """
    Recursively split text into chunks respecting the separator hierarchy.
    """
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    # Find the best separator
    for sep in _SEPARATORS:
        if sep in text:
            parts = text.split(sep)
            chunks: list[str] = []
            current = ""

            for part in parts:
                candidate = f"{current}{sep}{part}" if current else part

                if len(candidate) <= chunk_size:
                    current = candidate
                else:
                    if current:
                        chunks.append(current.strip())
                    # If a single part exceeds chunk_size, force-split it
                    if len(part) > chunk_size:
                        chunks.extend(_force_split(part, chunk_size))
                        current = ""
                    else:
                        current = part

            if current.strip():
                chunks.append(current.strip())

            # Apply overlap
            if chunk_overlap > 0 and len(chunks) > 1:
                chunks = _apply_overlap(chunks, chunk_overlap)

            return [c for c in chunks if c.strip()]

    # No separator found — force split by character count
    return _force_split(text, chunk_size)


def _force_split(text: str, chunk_size: int) -> list[str]:
    """Split text into fixed-size pieces when no natural boundary exists."""
    return [text[i:i + chunk_size].strip() for i in range(0, len(text), chunk_size) if text[i:i + chunk_size].strip()]


def _apply_overlap(chunks: list[str], overlap: int) -> list[str]:
    """Add trailing overlap from the previous chunk to the start of the next."""
    result = [chunks[0]]
    for i in range(1, len(chunks)):
        prev_tail = chunks[i - 1][-overlap:] if len(chunks[i - 1]) >= overlap else chunks[i - 1]
        result.append(f"{prev_tail} {chunks[i]}")
    return result


def chunk_text(text: str, file_path: str) -> list[Chunk]:
    """
    Split document text into overlapping chunks with metadata.

    Parameters
    ----------
    text : str
        The full extracted text of the document.
    file_path : str
        The ownCloud file path (used as metadata for source attribution).

    Returns
    -------
    list[Chunk]
        Ordered list of text chunks with file_path and index metadata.
    """
    settings = get_settings()
    raw_chunks = _split_text(text, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)

    total = len(raw_chunks)
    return [
        Chunk(
            text=c,
            file_path=file_path,
            chunk_index=i,
            total_chunks=total,
        )
        for i, c in enumerate(raw_chunks)
    ]
