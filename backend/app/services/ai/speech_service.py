# Issues short-lived Azure Speech Service tokens for the frontend browser SDK.
# The subscription key never leaves the server — the frontend receives only a
# time-limited token and the region, which is the correct security pattern for
# browser-based speech recognition.
import httpx
from fastapi import HTTPException

from app.database import settings


class SpeechService:
    def __init__(self) -> None:
        self._key = settings.azure_speech_key
        self._endpoint = settings.azure_speech_endpoint.rstrip("/")
        self.region = settings.azure_speech_region

    async def issue_token(self) -> str:
        if not self._key:
            raise HTTPException(status_code=503, detail="Azure Speech Service is not configured.")
        url = f"{self._endpoint}/sts/v1.0/issueToken"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, headers={"Ocp-Apim-Subscription-Key": self._key}
                )
                response.raise_for_status()
                return response.text
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Azure Speech token request failed: {e.response.status_code}",
            ) from e
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502, detail="Could not reach Azure Speech Service."
            ) from e
