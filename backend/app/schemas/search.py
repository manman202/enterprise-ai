from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str
    n_results: int = Field(default=5, ge=1, le=20)


class SearchResult(BaseModel):
    document_id: str
    filename: str
    excerpt: str
    score: float  # cosine similarity: 1.0 = perfect match, 0.0 = unrelated


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
