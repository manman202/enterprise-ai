from fastapi import APIRouter, Depends, HTTPException

from app.db.chroma import get_chroma
from app.schemas.search import SearchRequest, SearchResponse, SearchResult

router = APIRouter()

CHROMA_COLLECTION = "documents"
EXCERPT_LENGTH = 300


@router.post("/search", response_model=SearchResponse)
async def search(body: SearchRequest, chroma=Depends(get_chroma)):
    if not body.query.strip():
        raise HTTPException(status_code=422, detail="query must not be empty")

    try:
        collection = await chroma.get_collection(CHROMA_COLLECTION)
    except Exception:
        # Collection does not exist yet (no documents uploaded)
        return SearchResponse(query=body.query, results=[])

    raw = await collection.query(
        query_texts=[body.query],
        n_results=body.n_results,
        include=["documents", "metadatas", "distances"],
    )

    ids = raw["ids"][0]
    texts = raw["documents"][0]
    metadatas = raw["metadatas"][0]
    distances = raw["distances"][0]

    results = [
        SearchResult(
            document_id=doc_id,
            filename=meta.get("filename", "unknown"),
            excerpt=text[:EXCERPT_LENGTH],
            score=round(1 - distance, 4),
        )
        for doc_id, text, meta, distance in zip(ids, texts, metadatas, distances)
    ]

    return SearchResponse(query=body.query, results=results)
