"""
LLM service — connects to Google Gemini API for chat completions.

Uses the google-genai SDK to generate answers from RAG context.
The model is instructed to answer strictly from the provided context
and to cite source file paths for every claim.
"""

import base64
import logging
from dataclasses import dataclass, field

from google import genai
from google.genai import types
from pydantic import BaseModel

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


def ask(
    question: str,
    context_results: list[SearchResult],
    images: list[dict] | None = None,
    response_length: str = "medium",
) -> LLMResponse:
    """
    Send a question to Google Gemini with RAG context, optional images, and a response length setting.

    Parameters
    ----------
    question : str
        The user's question.
    context_results : list[SearchResult]
        Relevant chunks retrieved from the vector store.
    images : list[dict] | None
        Optional list of base64 image data and mime types.
    response_length : str
        The requested response length ("short" | "medium" | "long").

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

    # 1. Base instructions for response length
    length_instruction = ""
    max_tokens = 1024
    if response_length == "short":
        max_tokens = 256
        length_instruction = "\nIMPORTANT: Provide an extremely short, direct, and concise response (1-2 sentences or very brief bullet points only). Do not write introductory or filler text."
    elif response_length == "long":
        max_tokens = 2048
        length_instruction = "\nIMPORTANT: Provide a detailed, thorough, and comprehensive response. Explain concepts deeply, structure your response with detailed headings, and provide thorough context."
    else:  # medium
        max_tokens = 1024
        length_instruction = "\nIMPORTANT: Provide a standard response of medium length (1-3 paragraphs)."

    # 2. Build contents list
    contents = []

    # RAG context excerpts
    context_prompt = _build_context_prompt(context_results)
    contents.append(context_prompt)

    # Add base64 image parts (multimodal Gemini)
    if images:
        for img in images:
            try:
                img_data = img.get("data", "")
                img_mime = img.get("mime_type", "")
                if img_data:
                    img_bytes = base64.b64decode(img_data)
                    part = types.Part.from_bytes(data=img_bytes, mime_type=img_mime)
                    contents.append(part)
            except Exception as e:
                logger.error(f"Failed to decode image payload: {e}")

    # User's question
    user_prompt = f"\n\n--- User Question ---\n{question}" if question else "\n\nAnalyze the attached image(s)."
    contents.append(user_prompt)

    # Apply system prompt combining length instruction
    full_system_prompt = SYSTEM_PROMPT + length_instruction

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=full_system_prompt,
                temperature=0.3,
                max_output_tokens=max_tokens,
            ),
        )

        answer = response.text or "No response generated."
    except Exception as e:
        logger.error(f"Gemini request failed: {e}")
        return LLMResponse(
            answer=f"An error occurred while contacting the AI service: {e}",
            sources=[],
        )

    # Build deduplicated source list of ONLY files cited/mentioned in the answer
    seen_paths: set[str] = set()
    sources: list[dict] = []
    
    answer_lower = answer.lower()
    
    for r in context_results:
        if r.file_path not in seen_paths:
            # Check if the filename or the full path is in the response text
            filename = r.file_path.split("/")[-1] if "/" in r.file_path else r.file_path
            filename_lower = filename.lower()
            path_lower = r.file_path.lower()
            
            # Check if full path or filename is cited
            if path_lower in answer_lower or filename_lower in answer_lower:
                seen_paths.add(r.file_path)
                snippet = r.text[:150] + "..." if len(r.text) > 150 else r.text
                sources.append({
                    "file_path": r.file_path,
                    "snippet": snippet,
                })

    return LLMResponse(answer=answer, sources=sources)


class DocumentSummary(BaseModel):
    summary: str
    takeaways: list[str]
    tags: list[str]


def summarize_document(file_path: str, chunk_texts: list[str]) -> DocumentSummary:
    """
    Generate an AI summary, takeaways, and tags for a document using Gemini.
    """
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        return DocumentSummary(
            summary="Gemini API Key is not configured.",
            takeaways=["Please set the GEMINI_API_KEY environment variable."],
            tags=["unconfigured"]
        )

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    # Combine chunks up to ~15,000 characters to keep it quick and cost-effective
    full_text = "\n\n".join(chunk_texts)[:15000]
    
    prompt = f"""You are an expert document analysis assistant. Analyze the following document text from file '{file_path}'.
Produce a summary of the document, a list of key takeaways, and a few high-level categorizing tags.

Document text:
{full_text}
"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction="You extract structured summaries of enterprise documents. Be concise and professional. Do not hallucinate or include introductory/outro text. Return ONLY the requested JSON format.",
                response_mime_type="application/json",
                response_schema=DocumentSummary,
                temperature=0.2,
            ),
        )
        import json
        data = json.loads(response.text)
        return DocumentSummary(**data)
    except Exception as e:
        logger.error(f"Failed to generate summary for {file_path}: {e}")
        return DocumentSummary(
            summary=f"Failed to generate summary: {str(e)}",
            takeaways=["Ensure the file has valid readable content.", "Check your Gemini API quota."],
            tags=["error"]
        )

