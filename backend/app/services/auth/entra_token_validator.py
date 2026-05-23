import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient, PyJWKClientError

from app.database import settings

# Module-level JWKS client cache keyed by JWKS URI
_jwks_clients: dict[str, PyJWKClient] = {}


def _get_jwks_client(jwks_uri: str) -> PyJWKClient:
    if jwks_uri not in _jwks_clients:
        _jwks_clients[jwks_uri] = PyJWKClient(jwks_uri, cache_jwk_set=True, lifespan=3600)
    return _jwks_clients[jwks_uri]


def validate_entra_token(token: str) -> dict:
    """Validate an Entra External ID access token via JWKS and return its claims."""
    authority = settings.azure_entra_authority.rstrip("/")
    if not authority:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication provider not configured",
        )

    jwks_uri = f"{authority}/discovery/v2.0/keys"
    audience = settings.azure_entra_audience or settings.azure_entra_client_id

    try:
        client = _get_jwks_client(jwks_uri)
        signing_key = client.get_signing_key_from_jwt(token)
    except PyJWKClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to fetch token signing key",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    try:
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audience,
            options={"verify_exp": True, "verify_aud": True},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
