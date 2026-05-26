"""
Unit tests for _provision_user — the core identity-provisioning logic.

These tests call the function directly with a real SQLite DB session,
bypassing HTTP transport and JWT validation entirely. This keeps them
fast and focused on the business rules of user provisioning.

Each test patches `settings` so tests don't depend on environment variables.
"""
import pytest
from fastapi import HTTPException
from sqlalchemy import insert, select
from unittest.mock import patch, MagicMock

from app.models.user import User
from app.services.auth.auth_service import _provision_user
from tests.conftest import make_claims

# Path to the settings object used inside auth_service; patched per test.
_SETTINGS_PATH = "app.services.auth.auth_service.settings"


def _settings(admin_oid: str = "", admin_email: str = "") -> MagicMock:
    """Return a minimal settings mock with the two fields _provision_user reads."""
    s = MagicMock()
    s.azure_entra_admin_oid = admin_oid
    s.azure_entra_admin_email = admin_email
    return s


# ── New user provisioning ─────────────────────────────────────────────────────

async def test_new_user_created_from_oid_only(db):
    """
    When the Entra token has no email claim, a synthetic placeholder email is
    stored so the NOT NULL / UNIQUE constraint on users.email is satisfied.
    """
    claims = make_claims(oid="oid-001", name="Alice")

    with patch(_SETTINGS_PATH, _settings()):
        user = await _provision_user(claims, db)

    assert user.entra_oid == "oid-001"
    assert user.username == "Alice"
    assert user.email == "oid-001@entraoid.local"
    assert user.role == "user"
    assert user.is_active is True


async def test_new_user_created_with_real_email(db):
    """When the token contains an email claim, it is stored directly."""
    claims = make_claims(oid="oid-002", name="Bob", email="bob@example.com")

    with patch(_SETTINGS_PATH, _settings()):
        user = await _provision_user(claims, db)

    assert user.email == "bob@example.com"
    assert user.role == "user"


async def test_display_name_falls_back_to_email_prefix(db):
    """When the name claim is the placeholder 'unknown', the email prefix is used instead."""
    claims = make_claims(oid="oid-003", name="unknown", email="jane.doe@example.com")

    with patch(_SETTINGS_PATH, _settings()):
        user = await _provision_user(claims, db)

    assert user.username == "jane.doe"


# ── Admin promotion ───────────────────────────────────────────────────────────

async def test_admin_promoted_via_token_roles(db):
    """
    Any App Role assigned in Azure (present in the token's `roles` array)
    grants the admin role locally. This lets Azure Portal be the single source
    of truth for who is an admin — no DB edits required.
    """
    claims = make_claims(oid="oid-004", roles=["some-app-role-guid"])

    with patch(_SETTINGS_PATH, _settings()):
        user = await _provision_user(claims, db)

    assert user.role == "admin"


async def test_admin_promoted_via_oid_setting(db):
    """
    A user whose OID matches AZURE_ENTRA_ADMIN_OID is promoted to admin even
    if they have no App Role. This supports the fallback OID-based admin config.
    """
    # Pre-seed the admin record as the production seed_admin routine would.
    await db.execute(
        insert(User).values(
            email="admin@example.com", username="admin", is_active=True, role="admin"
        )
    )
    await db.commit()

    claims = make_claims(oid="admin-oid", email="admin@example.com")

    with patch(_SETTINGS_PATH, _settings(admin_oid="admin-oid", admin_email="admin@example.com")):
        user = await _provision_user(claims, db)

    assert user.role == "admin"
    assert user.entra_oid == "admin-oid"


# ── Returning user (fast path) ────────────────────────────────────────────────

async def test_returning_user_not_duplicated(db):
    """
    Calling _provision_user twice for the same OID should result in exactly
    one DB record — the fast path returns the existing row without inserting.
    """
    claims = make_claims(oid="oid-005", email="carol@example.com")

    with patch(_SETTINGS_PATH, _settings()):
        await _provision_user(claims, db)
        await _provision_user(claims, db)

    result = await db.execute(select(User).where(User.entra_oid == "oid-005"))
    assert len(result.scalars().all()) == 1


async def test_stale_username_updated_on_login(db):
    """
    If the stored username is the placeholder 'User' (set before the display-name
    fix), the next login overwrites it with the real name from the token.
    """
    await db.execute(
        insert(User).values(
            email="oid-006@entraoid.local",
            username="User",       # stale placeholder from earlier provisioning
            entra_oid="oid-006",
            is_active=True,
            role="user",
        )
    )
    await db.commit()

    claims = make_claims(oid="oid-006", name="Dana")

    with patch(_SETTINGS_PATH, _settings()):
        user = await _provision_user(claims, db)

    assert user.username == "Dana"


async def test_role_synced_down_when_azure_role_removed(db):
    """
    If an admin's App Role is removed in Azure, their local role is demoted to
    'user' on the next login. Azure remains the source of truth.
    """
    await db.execute(
        insert(User).values(
            email="oid-007@entraoid.local",
            username="Ex-Admin",
            entra_oid="oid-007",
            is_active=True,
            role="admin",          # was admin; role was removed in Azure
        )
    )
    await db.commit()

    # Token now has no `roles` array and OID does not match admin_oid.
    claims = make_claims(oid="oid-007")

    with patch(_SETTINGS_PATH, _settings()):
        user = await _provision_user(claims, db)

    assert user.role == "user"


async def test_role_synced_up_when_azure_role_added(db):
    """
    If a regular user is assigned an App Role in Azure, they are promoted to
    admin on their next login without any manual DB update.
    """
    await db.execute(
        insert(User).values(
            email="oid-008@entraoid.local",
            username="Newly Promoted",
            entra_oid="oid-008",
            is_active=True,
            role="user",
        )
    )
    await db.commit()

    claims = make_claims(oid="oid-008", roles=["some-role-guid"])

    with patch(_SETTINGS_PATH, _settings()):
        user = await _provision_user(claims, db)

    assert user.role == "admin"


# ── Error cases ───────────────────────────────────────────────────────────────

async def test_missing_oid_raises_401(db):
    """A token with no oid or sub claim cannot be provisioned — raises HTTP 401."""
    claims = {"name": "Ghost"}   # deliberately missing all identity claims

    with patch(_SETTINGS_PATH, _settings()):
        with pytest.raises(HTTPException) as exc_info:
            await _provision_user(claims, db)

    assert exc_info.value.status_code == 401
