from fastapi import APIRouter, HTTPException

from app.db.ollama import generate
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    if not body.message.strip():
        raise HTTPException(status_code=422, detail="message must not be empty")
    response = await generate(body.message)
    return ChatResponse(response=response)
