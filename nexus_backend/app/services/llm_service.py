"""
LLM service — connects to Google Gemini API for chat completions.

Uses the google-genai SDK to generate answers from RAG context.
The model is instructed to answer strictly from the provided context
and to cite source file paths for every claim.
"""

import logging
from dataclasses import dataclass, field

from google import genai

from app.core.config import get_settings
from app.services.vector_store import SearchResult

logger = logging.getLogger("nexus.llm")


@dataclass
class LLMResponse:
    """Structured response from the LLM."""
    answer: str
    sources: list[dict] = field(default_factory=list)  # [{ file_path, snippet }]


SYSTEM_PROMPT = """You are Nexus AI, an intelligent document assistant. You help users find information in their uploaded documents.

RULES:
1. Answer ONLY based on the provided context excerpts below. Do NOT make up information.
2. If the context does not contain enough information to answer, say so clearly.
3. Always cite your sources by referencing the file path where the information was found.
4. Format your answers in clear, readable markdown.
5. When citing sources, use this format inline: (Source: /path/to/file.pdf)
6. Be concise but thorough.
"""


def _build_context_prompt(results: list[SearchResult]) -> str:
    """Build the context section of the prompt from search results."""
    if not results:
        return "No relevant documents were found in the knowledge base."

    parts = ["Here are the relevant excerpts from the user's documents:\n"]
    for i, r in enumerate(results, 1):
        parts.append(f"--- Excerpt {i} (from: {r.file_path}) ---")
        parts.append(r.text)
        parts.append("")

    return "\n".join(parts)


def ask(question: str, context_results: list[SearchResult]) -> LLMResponse:
    """
    Send a question to Google Gemini with RAG context.

    Parameters
    ----------
    question : str
        The user's question.
    context_results : list[SearchResult]
        Relevant chunks retrieved from the vector store.

    Returns
    -------
    LLMResponse
        The AI's answer with source citations.
    """
    settings = get_settings()

    if not settings.GEMINI_API_KEY:
        return LLMResponse(
            answer="AI is not configured. Please set the GEMINI_API_KEY environment variable.",
            sources=[],
        )

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    context_prompt = _build_context_prompt(context_results)
    user_prompt = f"{context_prompt}\n\n--- User Question ---\n{question}"

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=user_prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.3,
                max_output_tokens=2048,
            ),
        )

        answer = response.text or "No response generated."
    except Exception as e:
        logger.error(f"Gemini request failed: {e}")
        return LLMResponse(
            answer=f"An error occurred while contacting the AI service: {e}",
            sources=[],
        )

    # Build deduplicated source list
    seen_paths: set[str] = set()
    sources: list[dict] = []
    for r in context_results:
        if r.file_path not in seen_paths:
            seen_paths.add(r.file_path)
            snippet = r.text[:150] + "..." if len(r.text) > 150 else r.text
            sources.append({
                "file_path": r.file_path,
                "snippet": snippet,
            })

    return LLMResponse(answer=answer, sources=sources)
