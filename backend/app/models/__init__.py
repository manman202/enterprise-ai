"""
Import all models here so SQLAlchemy's Base.metadata knows about them.
Alembic env.py imports this module to auto-detect schema changes.
"""

from app.models.audit_log import AuditLog  # noqa: F401
from app.models.conversation import Conversation  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.message import Message  # noqa: F401
from app.models.user import User  # noqa: F401
