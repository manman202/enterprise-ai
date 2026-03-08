"""
Chat endpoints — message sending, conversation management, and WebSocket streaming.

Endpoints:
  POST   /api/v1/chat/message                    — send message, get RAG response
  GET    /api/v1/chat/conversations              — list user's conversations
  GET    /api/v1/chat/history/{conversation_id} — get all messages in a conversation
  DELETE /api/v1/chat/conversations/{id}         — delete a conversation
  WS     /ws/chat/{conversation_id}             — streaming tokens via WebSocket
"""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rag import build_rag_prompt, rag_query
from app.core.embeddings import embed_text
from app.db.chroma import query_documents
from app.db.ollama import generate_stream
from app.db.postgres import get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse, ConversationOut, MessageOut, SourceCitation

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_sources(sources_json: str | None) -> list[SourceCitation]:
    """Deserialise the stored JSON sources back into Pydantic objects."""
    if not sources_json:
        return []
    try:
        raw = json.loads(sources_json)
        return [SourceCitation(**s) for s in raw]
    except Exception:
        return []


def _departments(user: User) -> list[str] | None:
    """Return user's AD groups as department filter, or None for admin (all access)."""
    if user.is_admin:
        return None   # Admin sees all departments
    if user.department:
        return [user.department]
    return None       # No department = no filter (allow all until AD configured)


async def _get_or_create_conversation(
    conversation_id: str | None,
    user: User,
    db: AsyncSession,
    first_message: str,
) -> Conversation:
    """Return existing conversation or create a new one."""
    if conversation_id:
        conv = await db.get(Conversation, conversation_id)
        if conv is None or conv.user_id != user.id:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conv

    # Auto-title: first 60 characters of the message
    title = first_message[:60].rstrip() + ("…" if len(first_message) > 60 else "")
    conv = Conversation(user_id=user.id, title=title)
    db.add(conv)
    await db.flush()     # Obtain ID before adding messages
    return conv


async def _load_history(conversation_id: str, db: AsyncSession) -> list[dict]:
    """Return recent messages as simple dicts for RAG prompt building."""
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(10)                              # Last 10 turns max
    )
    messages = list(reversed(result.scalars().all()))
    return [{"role": m.role, "content": m.content} for m in messages]


# ── POST /chat/message ─────────────────────────────────────────────────────────

@router.post("/chat/message", response_model=ChatResponse)
async def send_message(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a user message, run the RAG pipeline, and return the AI response.
    Creates a new conversation if conversation_id is not provided.
    Persists both the user message and assistant response to the DB.
    """
    if not body.message.strip():
        raise HTTPException(status_code=422, detail="Message must not be empty")

    # Get or create conversation
    conv = await _get_or_create_conversation(
        body.conversation_id, current_user, db, body.message
    )

    # Load recent history for context
    history = await _load_history(conv.id, db)

    # Persist user message
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=body.message,
    )
    db.add(user_msg)

    # Run RAG pipeline
    departments = _departments(current_user)
    answer, chunks = await rag_query(
        question=body.message,
        user_departments=departments,
        history=history,
    )

    # Persist assistant response with sources
    sources_data = [
        {
            "document_id": c["document_id"],
            "filename": c["filename"],
            "department": c["department"],
            "excerpt": c["excerpt"],
            "score": c["score"],
        }
        for c in chunks
    ]
    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=answer,
        sources=json.dumps(sources_data),
    )
    db.add(assistant_msg)

    # Update conversation metadata
    conv.updated_at = datetime.utcnow()
    conv.message_count += 2  # user + assistant

    await db.commit()

    return ChatResponse(
        response=answer,
        sources=[SourceCitation(**s) for s in sources_data],
        conversation_id=conv.id,
    )


# ── GET /chat/conversations ────────────────────────────────────────────────────

@router.get("/chat/conversations", response_model=list[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all conversations for the authenticated user, newest first."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    )
    return result.scalars().all()


# ── GET /chat/history/{conversation_id} ───────────────────────────────────────

@router.get("/chat/history/{conversation_id}", response_model=list[MessageOut])
async def get_history(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all messages in a conversation (must belong to current user)."""
    conv = await db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()

    return [
        MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            sources=_parse_sources(m.sources),
            created_at=m.created_at,
        )
        for m in messages
    ]


# ── DELETE /chat/conversations/{id} ───────────────────────────────────────────

@router.delete("/chat/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation and all its messages (must belong to current user)."""
    conv = await db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conv)
    await db.commit()


# ── WebSocket /ws/chat/{conversation_id} ──────────────────────────────────────

async def websocket_chat(websocket: WebSocket, conversation_id: str):
    """
    WebSocket endpoint for streaming chat responses token-by-token.

    Protocol:
      Client → Server: JSON {"message": "...", "token": "bearer_token"}
      Server → Client: text tokens as they stream from Ollama
      Server → Client: JSON {"done": true, "sources": [...], "conversation_id": "..."}
                        at end of stream

    The token is passed in the first message because WebSocket connections
    cannot carry Authorization headers in browsers.
    """
    await websocket.accept()
    db: AsyncSession | None = None

    try:
        # Step 1: receive the first message which must contain auth token + question
        raw = await websocket.receive_text()
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            await websocket.send_text(json.dumps({"error": "Invalid JSON"}))
            await websocket.close()
            return

        message = payload.get("message", "").strip()
        token = payload.get("token", "")

        if not message:
            await websocket.send_text(json.dumps({"error": "Message is required"}))
            await websocket.close()
            return

        # Step 2: validate JWT and get user
        from app.core.security import decode_access_token
        import jwt as _jwt
        from app.db.postgres import AsyncSessionLocal

        try:
            user_id = decode_access_token(token)
        except _jwt.PyJWTError:
            await websocket.send_text(json.dumps({"error": "Invalid token"}))
            await websocket.close()
            return

        async with AsyncSessionLocal() as db:
            user = await db.get(User, user_id)
            if user is None or not user.is_active:
                await websocket.send_text(json.dumps({"error": "User not found"}))
                await websocket.close()
                return

            # Step 3: get or create conversation
            conv = await _get_or_create_conversation(
                conversation_id if conversation_id != "new" else None,
                user, db, message,
            )

            history = await _load_history(conv.id, db)

            # Step 4: persist user message
            user_msg = Message(conversation_id=conv.id, role="user", content=message)
            db.add(user_msg)
            await db.flush()

            # Step 5: build RAG context (embed + retrieve)
            departments = _departments(user)
            try:
                question_embedding = embed_text(message)
                chunks = await query_documents(
                    query_embedding=question_embedding,
                    n_results=5,
                    department_filter=departments,
                )
            except Exception as exc:
                logger.error("RAG retrieval failed in WebSocket: %s", exc)
                chunks = []

            prompt = build_rag_prompt(message, chunks, history)

            # Step 6: stream tokens to client
            full_response = []
            try:
                async for token in generate_stream(prompt):
                    await websocket.send_text(token)
                    full_response.append(token)
            except WebSocketDisconnect:
                logger.info("WebSocket client disconnected during streaming")
                return

            answer = "".join(full_response).strip()

            # Step 7: persist assistant message
            sources_data = [
                {
                    "document_id": c["document_id"],
                    "filename": c["filename"],
                    "department": c["department"],
                    "excerpt": c["excerpt"],
                    "score": c["score"],
                }
                for c in chunks
            ]
            assistant_msg = Message(
                conversation_id=conv.id,
                role="assistant",
                content=answer,
                sources=json.dumps(sources_data),
            )
            db.add(assistant_msg)
            conv.updated_at = datetime.utcnow()
            conv.message_count += 2
            await db.commit()

            # Step 8: send completion signal with sources
            await websocket.send_text(json.dumps({
                "done": True,
                "sources": sources_data,
                "conversation_id": conv.id,
            }))

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for conversation '%s'", conversation_id)
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)
        try:
            await websocket.send_text(json.dumps({"error": str(exc)}))
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
