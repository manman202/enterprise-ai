"""Phase 5 models — extend User & Document, add Conversation, Message, AuditLog

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-08
"""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend users table ────────────────────────────────────────────────────
    op.add_column("users", sa.Column("full_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("department", sa.String(), nullable=True))
    op.add_column("users", sa.Column("ad_groups", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("last_login", sa.DateTime(), nullable=True))

    # Make hashed_password nullable (LDAP users don't have a local password)
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=True)

    # ── Extend documents table ─────────────────────────────────────────────────
    op.add_column("documents", sa.Column("filepath", sa.String(), nullable=True))
    op.add_column("documents", sa.Column("department", sa.String(), nullable=True))
    op.add_column("documents", sa.Column("file_hash", sa.String(), nullable=True))
    op.add_column("documents", sa.Column("status", sa.String(), nullable=False, server_default="pending"))
    op.add_column("documents", sa.Column("chunks_count", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("ingested_at", sa.DateTime(), nullable=True))
    op.add_column("documents", sa.Column("error_message", sa.Text(), nullable=True))
    op.create_index("ix_documents_department", "documents", ["department"])
    op.create_index("ix_documents_status", "documents", ["status"])

    # ── Create conversations table ─────────────────────────────────────────────
    op.create_table(
        "conversations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(), nullable=False, default="New conversation"),
        sa.Column("message_count", sa.Integer(), nullable=False, default=0),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"])

    # ── Create messages table ──────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("conversation_id", sa.String(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sources", sa.Text(), nullable=True),
        sa.Column("tokens_used", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])

    # ── Create audit_logs table ────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("resource", sa.String(), nullable=True),
        sa.Column("outcome", sa.String(), nullable=False, default="allow"),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    # ── Drop new tables ────────────────────────────────────────────────────────
    op.drop_table("audit_logs")
    op.drop_table("messages")
    op.drop_table("conversations")

    # ── Revert documents columns ───────────────────────────────────────────────
    op.drop_index("ix_documents_status", "documents")
    op.drop_index("ix_documents_department", "documents")
    op.drop_column("documents", "error_message")
    op.drop_column("documents", "ingested_at")
    op.drop_column("documents", "chunks_count")
    op.drop_column("documents", "status")
    op.drop_column("documents", "file_hash")
    op.drop_column("documents", "department")
    op.drop_column("documents", "filepath")

    # ── Revert user columns ────────────────────────────────────────────────────
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=False)
    op.drop_column("users", "last_login")
    op.drop_column("users", "ad_groups")
    op.drop_column("users", "department")
    op.drop_column("users", "full_name")
