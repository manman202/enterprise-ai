from pydantic import BaseModel


class UserUpdateRequest(BaseModel):
    is_active: bool | None = None
    is_admin: bool | None = None
