from pydantic import BaseModel, EmailStr, field_validator


class ProfileUpdateRequest(BaseModel):
    username: str | None = None
    email: EmailStr | None = None

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if not v.isalnum():
            raise ValueError("Username must contain only letters and numbers")
        return v


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    def validate_match(self) -> None:
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
