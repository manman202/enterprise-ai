"""
Authentication helpers — LDAP/AD authentication with local DB fallback.

Flow:
  1. If AD_SERVER is configured → try LDAP bind with user credentials
     → on success: return user info dict from AD attributes
  2. If AD_SERVER is NOT set (dev mode) → fall back to local DB password check
     → used during development without an AD infrastructure
"""

import logging
from typing import Any

from ldap3 import ALL_ATTRIBUTES, Connection, Server
from ldap3.core.exceptions import LDAPBindError, LDAPException

from app.core.config import settings

logger = logging.getLogger(__name__)


def _make_user_dn(username: str) -> str:
    """
    Build the user's Distinguished Name for LDAP bind.
    Accepts both plain username (bob) and pre-qualified (bob@company.local).
    """
    if "@" in username or "," in username:
        return username  # Already qualified
    return f"{username}@{settings.ad_domain}" if settings.ad_domain else username


def ldap_authenticate(username: str, password: str) -> dict[str, Any] | None:
    """
    Attempt LDAP authentication against Active Directory.

    Returns:
        dict with {full_name, email, department, groups} on success
        None if credentials are invalid or LDAP is unreachable
    """
    if not settings.ldap_enabled:
        logger.debug("LDAP disabled — AD_SERVER not set, skipping LDAP auth")
        return None

    user_dn = _make_user_dn(username)

    try:
        server = Server(settings.ad_server, use_ssl=settings.ad_server.startswith("ldaps"))

        # First bind as the user to verify credentials
        with Connection(server, user=user_dn, password=password, auto_bind=True) as _:

            # Then search for the user's full attributes using the service account
            service_dn = _make_user_dn(settings.ad_service_account)
            with Connection(
                server,
                user=service_dn,
                password=settings.ad_service_password,
                auto_bind=True,
            ) as svc_conn:
                svc_conn.search(
                    search_base=settings.ad_base_dn,
                    search_filter=f"(sAMAccountName={username})",
                    attributes=ALL_ATTRIBUTES,
                )

                if not svc_conn.entries:
                    logger.warning("LDAP: user '%s' authenticated but not found in search", username)
                    return {"full_name": username, "email": "", "department": "", "groups": []}

                entry = svc_conn.entries[0]

                def _attr(name: str, default: str = "") -> str:
                    """Safely get an LDAP attribute value."""
                    val = getattr(entry, name, None)
                    return str(val) if val else default

                groups: list[str] = []
                if hasattr(entry, "memberOf") and entry.memberOf:
                    # Extract CN from each group DN: CN=GroupName,OU=...
                    for group_dn in entry.memberOf.values:
                        cn = str(group_dn).split(",")[0].replace("CN=", "")
                        groups.append(cn)

                return {
                    "full_name": _attr("displayName") or _attr("cn") or username,
                    "email": _attr("mail") or _attr("userPrincipalName"),
                    "department": _attr("department"),
                    "groups": groups,
                }

    except LDAPBindError:
        # Wrong password or account locked — expected for bad credentials
        logger.info("LDAP bind failed for user '%s' — invalid credentials", username)
        return None
    except LDAPException as exc:
        # Server unreachable or config error
        logger.error("LDAP error for user '%s': %s", username, exc)
        return None
    except Exception as exc:  # noqa: BLE001
        logger.error("Unexpected LDAP error: %s", exc)
        return None
