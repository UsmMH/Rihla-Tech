"""Test LLM connectivity (OpenRouter or OpenAI). Run from backend/: python scripts/test_llm.py"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.services.llm import get_llm_client, get_llm_model, get_llm_provider, llm_configured

if not llm_configured():
    print("FAIL: Set GEMINI_API_KEY, OPENROUTER_API_KEY, or OPENAI_API_KEY in .env")
    raise SystemExit(1)

provider = get_llm_provider()
print(f"Provider: {provider}")
print(f"Model: {get_llm_model()}")

client = get_llm_client()
assert client is not None

try:
    response = client.chat.completions.create(
        model=get_llm_model(),
        messages=[
            {"role": "system", "content": "Respond with valid JSON only."},
            {
                "role": "user",
                "content": 'Suggest 1 city as JSON array: [{"city":"...","country":"...","blurb":"..."}]',
            },
        ],
        max_tokens=200,
    )
    content = response.choices[0].message.content or ""
    print("SUCCESS: LLM responded")
    print(content[:300])
    cleaned = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    json.loads(cleaned)
    print("OK: response is valid JSON")
except Exception as exc:
    print(f"FAIL: {type(exc).__name__}: {exc}")
    raise SystemExit(1) from exc
