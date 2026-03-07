from datetime import datetime

from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: str
    filename: str
    size: int
    created_at: datetime

    model_config = {"from_attributes": True}
