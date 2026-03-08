"""
RAG (Retrieval-Augmented Generation) engine.

Query pipeline:
  1. Embed the user's question with the local embedding model
  2. Query ChromaDB — filtered by the user's department(s)
  3. Build a structured prompt: context + question + conversation history
  4. Call Ollama (Mistral) — batch or streaming
  5. Return (answer, sources)
"""

import logging
from typing import Any

from app.core.embeddings import embed_text
from app.db.chroma import query_documents
from app.db.ollama import generate

logger = logging.getLogger(__name__)

# Number of document chunks to retrieve per query
N_RESULTS = 5

# Max characters of chat history to include in the prompt
MAX_HISTORY_CHARS = 2000


def build_rag_prompt(
    question: str,
    chunks: list[dict[str, Any]],
    history: list[dict[str, str]] | None = None,
) -> str:
    """
    Assemble the full prompt sent to Mistral.

    Prompt structure:
      [System instruction]
      [Context from knowledge base]
      [Recent conversation history]
      [User question]

    The model is instructed to:
    - Answer ONLY from the provided context
    - Cite sources by filename
    - Respond in the user's language
    - Say "Je ne trouve pas cette information" if context is empty/irrelevant
    """
    system = (
        "Tu es Aiyedun, l'assistant IA interne de l'entreprise. "
        "Réponds UNIQUEMENT en te basant sur les documents fournis dans le contexte ci-dessous. "
        "Si l'information ne figure pas dans le contexte, réponds exactement : "
        "'Je ne trouve pas cette information dans les documents disponibles.' "
        "Ne jamais inventer d'information. "
        "Cite toujours les noms de fichiers sources entre crochets, ex: [nom_fichier.pdf]. "
        "Réponds dans la même langue que la question.\n"
    )

    # Build context block from retrieved chunks
    if chunks:
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            filename = chunk.get("filename", "unknown")
            dept = chunk.get("department", "")
            excerpt = chunk.get("excerpt", "")
            dept_label = f" ({dept})" if dept else ""
            context_parts.append(f"[{i}] Fichier: {filename}{dept_label}\n{excerpt}")
        context_block = "\n\n---\n\n".join(context_parts)
        context = f"\n\nCONTEXTE DOCUMENTAIRE:\n{context_block}\n"
    else:
        context = "\n\nCONTEXTE DOCUMENTAIRE: Aucun document pertinent trouvé.\n"

    # Include recent conversation history (trimmed to avoid huge prompts)
    history_block = ""
    if history:
        history_lines = []
        total_chars = 0
        # Walk history in reverse to prioritize recent messages
        for turn in reversed(history):
            role = "Utilisateur" if turn["role"] == "user" else "Aiyedun"
            line = f"{role}: {turn['content']}\n"
            if total_chars + len(line) > MAX_HISTORY_CHARS:
                break
            history_lines.insert(0, line)
            total_chars += len(line)

        if history_lines:
            history_block = "\n\nHISTORIQUE DE CONVERSATION:\n" + "".join(history_lines)

    # Final prompt
    prompt = (
        f"{system}"
        f"{context}"
        f"{history_block}"
        f"\nQuestion: {question}\n\nRéponse:"
    )
    return prompt


async def rag_query(
    question: str,
    user_departments: list[str] | None = None,
    history: list[dict[str, str]] | None = None,
    stream: bool = False,
) -> tuple[str, list[dict[str, Any]]]:
    """
    Run the full RAG pipeline and return the answer + source list.

    Args:
        question: User's question text
        user_departments: List of departments the user can access.
                          None = no filter (admin access).
        history: Recent messages [{"role": "user"|"assistant", "content": "..."}]
        stream: If True, uses streaming (not used in this non-WebSocket path)

    Returns:
        (answer_text, sources_list)
        sources_list items: {document_id, filename, department, excerpt, score}
    """
    # Step 1: embed the question
    try:
        question_embedding = embed_text(question)
    except Exception as exc:
        logger.error("Embedding failed: %s", exc)
        return (
            "Je ne peux pas traiter votre question pour le moment (service d'embedding indisponible).",
            [],
        )

    # Step 2: retrieve relevant chunks from ChromaDB
    chunks = await query_documents(
        query_embedding=question_embedding,
        n_results=N_RESULTS,
        department_filter=user_departments,
    )

    # Step 3: build prompt
    prompt = build_rag_prompt(question, chunks, history)

    # Step 4: generate answer
    try:
        answer = await generate(prompt)
    except Exception as exc:
        logger.error("Ollama generate failed: %s", exc)
        return (
            "Je ne peux pas répondre pour le moment (service IA indisponible).",
            [],
        )

    return answer.strip(), chunks
