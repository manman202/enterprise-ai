import pytest
import respx
from httpx import Response

from app.core.config import settings
from app.db.ollama import generate


@respx.mock
async def test_generate_returns_response_text():
    respx.post(f"{settings.ollama_url}/api/generate").mock(
        return_value=Response(200, json={"response": "Hello, world!"})
    )

    result = await generate("Say hello")

    assert result == "Hello, world!"


@respx.mock
async def test_generate_uses_default_model():
    route = respx.post(f"{settings.ollama_url}/api/generate").mock(
        return_value=Response(200, json={"response": "ok"})
    )

    await generate("ping")

    assert route.calls.last.request.content
    import json
    body = json.loads(route.calls.last.request.content)
    assert body["model"] == settings.ollama_model


@respx.mock
async def test_generate_raises_on_error():
    respx.post(f"{settings.ollama_url}/api/generate").mock(return_value=Response(500))

    with pytest.raises(Exception):
        await generate("fail")
