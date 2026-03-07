from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.chroma import get_chroma
from app.db.postgres import get_db
from app.models.document import Document
from app.schemas.document import DocumentOut

router = APIRouter()

CHROMA_COLLECTION = "documents"


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    return result.scalars().all()


@router.post("/documents", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    chroma=Depends(get_chroma),
):
    content = await file.read()
    text = content.decode("utf-8", errors="replace")

    doc = Document(filename=file.filename or "untitled", size=len(content))
    db.add(doc)
    await db.flush()

    collection = await chroma.get_or_create_collection(CHROMA_COLLECTION)
    await collection.add(
        documents=[text],
        ids=[doc.id],
        metadatas=[{"filename": doc.filename, "document_id": doc.id}],
    )

    await db.commit()
    await db.refresh(doc)
    return doc


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    chroma=Depends(get_chroma),
):
    doc = await db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    collection = await chroma.get_or_create_collection(CHROMA_COLLECTION)
    await collection.delete(ids=[doc_id])

    await db.delete(doc)
    await db.commit()
