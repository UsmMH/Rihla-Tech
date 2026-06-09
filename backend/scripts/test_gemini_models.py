import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.llm import get_llm_client

MODELS = [
    "gemini-2.0-flash",
    "gemini-2.5-flash-preview-05-20",
    "gemini-1.5-flash",
    "gemini-3.5-flash",
]

client = get_llm_client()
assert client

for model in MODELS:
    try:
        r = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": 'Return JSON only: [{"city":"Tokyo","country":"Japan","blurb":"test"}]',
                }
            ],
            max_tokens=200,
        )
        content = r.choices[0].message.content or ""
        print(f"\n{model}: OK")
        print(content[:200])
    except Exception as exc:
        print(f"\n{model}: FAIL {type(exc).__name__}: {exc}")
