"""
Analytics API — real DB-backed metrics for the admin dashboard.
All endpoints require admin privileges.

Routes:
  GET /api/v1/analytics/overview              — KPI summary
  GET /api/v1/analytics/queries-per-hour      — last 24h, one entry per hour
  GET /api/v1/analytics/queries-per-department — last N days, grouped by department
  GET /api/v1/analytics/top-documents         — top 10 cited documents
  GET /api/v1/analytics/daily-active-users    — last 30 days DAU
  GET /api/v1/analytics/response-times        — avg response ms per hour last 24h
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.postgres import get_db
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.message import Message
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ── Helpers ───────────────────────────────────────────────────────────────────


def _now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/overview")
async def analytics_overview(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Summary KPIs: queries today/week, active users today/week,
    total conversations, avg response time, no-answer rate, docs indexed.
    """
    now = _now_utc()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)

    # Queries today and this week (user messages only)
    queries_today_result = await db.execute(
        select(func.count(Message.id)).where(
            Message.role == "user",
            Message.created_at >= today_start,
        )
    )
    queries_today = queries_today_result.scalar() or 0

    queries_week_result = await db.execute(
        select(func.count(Message.id)).where(
            Message.role == "user",
            Message.created_at >= week_start,
        )
    )
    queries_week = queries_week_result.scalar() or 0

    # Active users today (distinct users with at least one message)
    active_today_result = await db.execute(
        select(func.count(func.distinct(Conversation.user_id)))
        .join(Message, Message.conversation_id == Conversation.id)
        .where(
            Message.role == "user",
            Message.created_at >= today_start,
        )
    )
    active_users_today = active_today_result.scalar() or 0

    # Active users this week
    active_week_result = await db.execute(
        select(func.count(func.distinct(Conversation.user_id)))
        .join(Message, Message.conversation_id == Conversation.id)
        .where(
            Message.role == "user",
            Message.created_at >= week_start,
        )
    )
    active_users_week = active_week_result.scalar() or 0

    # Total conversations
    total_conv_result = await db.execute(select(func.count(Conversation.id)))
    total_conversations = total_conv_result.scalar() or 0

    # Documents indexed
    docs_result = await db.execute(
        select(func.count(Document.id)).where(Document.status == "ingested")
    )
    documents_indexed = docs_result.scalar() or 0

    # No-answer rate: assistant messages with empty/no content or very short replies
    # (approximation: messages where content length < 50 chars suggest no answer)
    if queries_today > 0:
        no_answer_result = await db.execute(
            select(func.count(Message.id)).where(
                Message.role == "assistant",
                Message.created_at >= today_start,
                func.length(Message.content) < 100,
            )
        )
        no_answer_count = no_answer_result.scalar() or 0
        no_answer_rate = round(no_answer_count / queries_today, 3)
    else:
        no_answer_rate = 0.0

    return {
        "queries_today": queries_today,
        "queries_this_week": queries_week,
        "active_users_today": active_users_today,
        "active_users_this_week": active_users_week,
        "total_conversations": total_conversations,
        "avg_response_time_ms": 0,  # Not tracked in DB — computed in response-times endpoint
        "no_answer_rate": no_answer_rate,
        "documents_indexed": documents_indexed,
    }


@router.get("/queries-per-hour")
async def queries_per_hour(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Hourly query count for the last 24 hours.
    Returns 24 entries (one per hour) even if count is 0.
    """
    result = await db.execute(
        text(
            """
            SELECT
                DATE_TRUNC('hour', created_at) AS hour,
                COUNT(*) AS count
            FROM messages
            WHERE role = 'user'
              AND created_at > NOW() - INTERVAL '24 hours'
            GROUP BY 1
            ORDER BY 1
            """
        )
    )
    rows = result.fetchall()
    row_map = {r[0]: r[1] for r in rows}

    # Fill in missing hours with 0 so the chart always shows 24 points
    now = _now_utc()
    hours = []
    for i in range(23, -1, -1):
        slot = (now - timedelta(hours=i)).replace(minute=0, second=0, microsecond=0)
        hours.append({
            "hour": slot.isoformat() + "Z",
            "label": slot.strftime("%H:%M"),
            "count": int(row_map.get(slot, 0)),
        })
    return hours


@router.get("/queries-per-department")
async def queries_per_department(
    days: int = Query(default=7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Query count grouped by user department for the last N days.
    Departments that have no queries are omitted.
    """
    result = await db.execute(
        text(
            """
            SELECT
                COALESCE(u.department, 'Unknown') AS department,
                COUNT(m.id) AS count
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            JOIN users u ON c.user_id = u.id
            WHERE m.role = 'user'
              AND m.created_at > NOW() - INTERVAL ':days days'
            GROUP BY 1
            ORDER BY count DESC
            """.replace(":days days", f"{days} days")
        )
    )
    rows = result.fetchall()
    return [{"department": r[0], "count": int(r[1])} for r in rows]


@router.get("/top-documents")
async def top_documents(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Top 10 most cited documents based on sources JSON in assistant messages.
    Parses the sources JSON array from each message.
    """
    cutoff = _now_utc() - timedelta(days=days)

    # Fetch all assistant messages with sources in the time range
    result = await db.execute(
        select(Message.sources).where(
            Message.role == "assistant",
            Message.sources.isnot(None),
            Message.created_at >= cutoff,
        )
    )
    rows = result.scalars().all()

    # Tally document citations from the JSON sources arrays
    citation_counts: dict[str, dict] = {}
    for sources_json in rows:
        if not sources_json:
            continue
        try:
            sources = json.loads(sources_json)
            for src in sources:
                fname = src.get("filename", "")
                dept = src.get("department", "")
                if fname:
                    key = fname
                    if key not in citation_counts:
                        citation_counts[key] = {"filename": fname, "department": dept, "citation_count": 0}
                    citation_counts[key]["citation_count"] += 1
        except (json.JSONDecodeError, TypeError):
            continue

    # Sort by citation count, return top 10
    top = sorted(citation_counts.values(), key=lambda x: x["citation_count"], reverse=True)[:10]
    return top


@router.get("/daily-active-users")
async def daily_active_users(
    days: int = Query(default=30, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Daily active user count for the last N days.
    Returns one entry per day with count=0 for days with no activity.
    """
    result = await db.execute(
        text(
            f"""
            SELECT
                DATE_TRUNC('day', m.created_at)::date AS date,
                COUNT(DISTINCT c.user_id) AS count
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE m.role = 'user'
              AND m.created_at > NOW() - INTERVAL '{days} days'
            GROUP BY 1
            ORDER BY 1
            """
        )
    )
    rows = result.fetchall()
    row_map = {str(r[0]): int(r[1]) for r in rows}

    # Fill every day in the range with 0 if no data
    now = _now_utc()
    output = []
    for i in range(days - 1, -1, -1):
        d = (now - timedelta(days=i)).date()
        output.append({"date": str(d), "count": row_map.get(str(d), 0)})
    return output


@router.get("/response-times")
async def response_times(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Average response latency per hour for the last 24 hours.
    Computed as: time between a user message and the next assistant message
    in the same conversation. Hours with no data return null.
    """
    result = await db.execute(
        text(
            """
            SELECT
                DATE_TRUNC('hour', u.created_at) AS hour,
                AVG(EXTRACT(EPOCH FROM (a.created_at - u.created_at)) * 1000)::int AS avg_ms
            FROM messages u
            JOIN messages a
                ON  a.conversation_id = u.conversation_id
                AND a.role = 'assistant'
                AND a.created_at > u.created_at
            WHERE u.role = 'user'
              AND u.created_at > NOW() - INTERVAL '24 hours'
            GROUP BY 1
            ORDER BY 1
            """
        )
    )
    rows = result.fetchall()
    row_map = {r[0]: (int(r[1]) if r[1] is not None else None) for r in rows}

    now = _now_utc()
    hours = []
    for i in range(23, -1, -1):
        slot = (now - timedelta(hours=i)).replace(minute=0, second=0, microsecond=0)
        hours.append({
            "hour": slot.isoformat() + "Z",
            "label": slot.strftime("%H:%M"),
            "avg_ms": row_map.get(slot),
        })
    return hours
