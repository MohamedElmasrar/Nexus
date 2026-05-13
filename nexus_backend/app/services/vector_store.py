"""
Vector store service — wraps ChromaDB for document embedding and retrieval.

Uses sentence-transformers (all-MiniLM-L6-v2) for local embedding generation.
Data is persisted to disk so it survives restarts.
"""

import logging
from dataclasses import dataclass

import chromadb
from chromadb.utils import embedding_functions

from app.core.config import get_settings
from app.services.chunker import Chunk

logger = logging.getLogger("nexus.vectorstore")

COLLECTION_NAME = "nexus_documents"


@dataclass
class SearchResult:
    """A single search result from the vector store."""
    text: str
    file_path: str
    chunk_index: int
    distance: float


# ── Singleton client ───────────────────────────────────────────────────────

_client: chromadb.ClientAPI | None = None
_embedding_fn = None


def _get_embedding_fn():
    global _embedding_fn
    if _embedding_fn is None:
        _embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
    return _embedding_fn


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        settings = get_settings()
        _client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        logger.info(f"ChromaDB initialized at {settings.CHROMA_PERSIST_DIR}")
    return _client


def _get_collection():
    client = _get_client()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=_get_embedding_fn(),
        metadata={"hnsw:space": "cosine"},
    )


# ── Public API ─────────────────────────────────────────────────────────────


def index_chunks(chunks: list[Chunk]) -> int:
    """
    Embed and store document chunks in ChromaDB.

    Returns the number of chunks indexed.
    """
    if not chunks:
        return 0

    collection = _get_collection()

    ids = [f"{c.file_path}::chunk_{c.chunk_index}" for c in chunks]
    documents = [c.text for c in chunks]
    metadatas = [
        {
            "file_path": c.file_path,
            "chunk_index": c.chunk_index,
            "total_chunks": c.total_chunks,
        }
        for c in chunks
    ]

    # Upsert so re-indexing the same file replaces old chunks
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    logger.info(f"Indexed {len(chunks)} chunks for {chunks[0].file_path}")
    return len(chunks)


def search(query: str, n_results: int = 5) -> list[SearchResult]:
    """
    Search the vector store for chunks most relevant to the query.

    Returns ranked results with file paths and snippets.
    """
    collection = _get_collection()

    # Check if collection is empty
    if collection.count() == 0:
        return []

    results = collection.query(
        query_texts=[query],
        n_results=min(n_results, collection.count()),
    )

    search_results: list[SearchResult] = []
    if results and results["documents"] and results["documents"][0]:
        docs = results["documents"][0]
        metas = results["metadatas"][0] if results["metadatas"] else [{}] * len(docs)
        dists = results["distances"][0] if results["distances"] else [0.0] * len(docs)

        for doc, meta, dist in zip(docs, metas, dists):
            search_results.append(SearchResult(
                text=doc,
                file_path=meta.get("file_path", "unknown"),
                chunk_index=meta.get("chunk_index", 0),
                distance=dist,
            ))

    return search_results


def delete_document(file_path: str) -> int:
    """
    Remove all chunks for a given file path from the vector store.

    Returns the number of chunks deleted.
    """
    return delete_documents_by_path_prefix(file_path)


def delete_documents_by_path_prefix(path_prefix: str) -> int:
    """
    Remove all chunks for files matching the path or under the directory path.
    """
    collection = _get_collection()

    all_data = collection.get(include=["metadatas"])
    if not all_data or not all_data["metadatas"]:
        return 0

    ids_to_delete = []
    for doc_id, meta in zip(all_data["ids"], all_data["metadatas"]):
        fp = meta.get("file_path", "")
        if fp == path_prefix or fp.startswith(path_prefix.rstrip("/") + "/"):
            ids_to_delete.append(doc_id)

    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
        logger.info(f"Deleted {len(ids_to_delete)} chunks for prefix {path_prefix}")
        return len(ids_to_delete)

    return 0


def get_indexed_files() -> list[dict]:
    """Return a summary of all indexed files."""
    collection = _get_collection()

    if collection.count() == 0:
        return []

    # Get all metadata
    all_data = collection.get(include=["metadatas"])
    if not all_data or not all_data["metadatas"]:
        return []

    # Group by file_path
    file_map: dict[str, int] = {}
    for meta in all_data["metadatas"]:
        fp = meta.get("file_path", "unknown")
        file_map[fp] = file_map.get(fp, 0) + 1

    return [
        {"file_path": fp, "chunk_count": count}
        for fp, count in sorted(file_map.items())
    ]
