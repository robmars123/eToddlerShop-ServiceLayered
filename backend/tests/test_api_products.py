"""
Integration tests for the /api/v1/products endpoints.

These tests exercise the full HTTP stack — routing, dependency injection,
service layer, and SQLite DB — with external services (Azure OpenAI, Redis)
replaced by no-op stubs defined in conftest.py.

Fixtures used (from conftest.py):
    client       — unauthenticated
    user_client  — authenticated as role="user"
    admin_client — authenticated as role="admin"
"""
import pytest

BASE = "/api/v1/products/"


def _product(name: str = "Baby Shoes", price: float = 19.99) -> dict:
    """Minimal valid product payload."""
    return {"name": name, "price": price}


# ── Public read access ────────────────────────────────────────────────────────

async def test_list_products_is_public(client):
    """GET /products/ requires no authentication and returns an empty list initially."""
    response = await client.get(BASE)
    assert response.status_code == 200
    assert response.json() == []


async def test_list_products_returns_created_items(admin_client, client):
    """Products created by an admin appear in the public listing."""
    await admin_client.post(BASE, json=_product("Rattle", 5.99))
    await admin_client.post(BASE, json=_product("Bib", 3.49))

    response = await client.get(BASE)
    names = [p["name"] for p in response.json()]
    assert "Rattle" in names
    assert "Bib" in names


async def test_get_single_product(admin_client, client):
    """GET /products/{id} returns the correct product by ID."""
    created = await admin_client.post(BASE, json=_product("Teether", 8.00))
    product_id = created.json()["id"]

    response = await client.get(f"{BASE}{product_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Teether"


async def test_get_nonexistent_product_returns_404(client):
    """Requesting a product ID that does not exist returns 404."""
    response = await client.get(f"{BASE}99999")
    assert response.status_code == 404


# ── Admin-only write operations ───────────────────────────────────────────────

async def test_create_product_requires_auth(client):
    """POST /products/ without any credentials is rejected (401 or 403)."""
    response = await client.post(BASE, json=_product())
    assert response.status_code in (401, 403)


async def test_create_product_forbidden_for_regular_user(user_client):
    """A logged-in non-admin user cannot create products."""
    response = await user_client.post(BASE, json=_product())
    assert response.status_code == 403


async def test_admin_can_create_product(admin_client):
    """An admin receives the created product with a generated ID."""
    response = await admin_client.post(BASE, json=_product("Soft Block", 12.50))
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Soft Block"
    assert data["price"] == 12.50
    assert isinstance(data["id"], int)


async def test_create_product_validates_price(admin_client):
    """price must be > 0; a zero or negative price is rejected with 422."""
    response = await admin_client.post(BASE, json={"name": "Free Toy", "price": 0})
    assert response.status_code == 422


async def test_create_product_validates_name_required(admin_client):
    """name is required; missing it is rejected with 422."""
    response = await admin_client.post(BASE, json={"price": 5.00})
    assert response.status_code == 422


async def test_admin_can_update_product(admin_client):
    """An admin can change a product's price; the updated value is persisted."""
    created = await admin_client.post(BASE, json=_product("Block Set", 15.00))
    product_id = created.json()["id"]

    response = await admin_client.put(f"{BASE}{product_id}", json={"price": 17.50})
    assert response.status_code == 200
    assert response.json()["price"] == 17.50


async def test_update_product_forbidden_for_regular_user(admin_client, user_client):
    """A regular user cannot update products."""
    created = await admin_client.post(BASE, json=_product("Plush", 9.00))
    product_id = created.json()["id"]

    response = await user_client.put(f"{BASE}{product_id}", json={"price": 1.00})
    assert response.status_code == 403


async def test_admin_can_delete_product(admin_client):
    """Deleting a product removes it — subsequent GET returns 404."""
    created = await admin_client.post(BASE, json=_product("Disposable", 1.00))
    product_id = created.json()["id"]

    delete_response = await admin_client.delete(f"{BASE}{product_id}")
    assert delete_response.status_code == 204

    get_response = await admin_client.get(f"{BASE}{product_id}")
    assert get_response.status_code == 404


async def test_delete_product_forbidden_for_regular_user(admin_client, user_client):
    """A regular user cannot delete products."""
    created = await admin_client.post(BASE, json=_product("Protected", 5.00))
    product_id = created.json()["id"]

    response = await user_client.delete(f"{BASE}{product_id}")
    assert response.status_code == 403
