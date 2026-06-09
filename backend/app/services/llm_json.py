"""Parse and salvage JSON from LLM responses."""

import json
import re
from typing import Any

_OBJECT_DECODER = json.JSONDecoder()


def strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    return text


def _salvage_objects_from_array_slice(text: str) -> list[dict]:
    results: list[dict] = []
    idx = 0
    while idx < len(text):
        while idx < len(text) and text[idx] in " \t\n\r,":
            idx += 1
        if idx >= len(text) or text[idx] in "]":
            break
        if text[idx] != "{":
            idx += 1
            continue
        try:
            obj, end = _OBJECT_DECODER.raw_decode(text, idx)
            if isinstance(obj, dict):
                results.append(obj)
            idx = end
        except json.JSONDecodeError:
            idx += 1
    return results


def _regex_destination_objects(text: str) -> list[dict]:
    pattern = re.compile(
        r'\{\s*"city"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"country"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"blurb"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}',
        re.DOTALL,
    )
    return [
        {"city": m.group(1), "country": m.group(2), "blurb": m.group(3)}
        for m in pattern.finditer(text)
    ]


def parse_llm_json_array(content: str, *, min_items: int = 1) -> list[dict]:
    text = strip_code_fences(content)

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            items = [x for x in parsed if isinstance(x, dict)]
            if len(items) >= min_items:
                return items
        if isinstance(parsed, dict):
            for key in ("suggestions", "cities", "destinations", "items", "days"):
                value = parsed.get(key)
                if isinstance(value, list):
                    items = [x for x in value if isinstance(x, dict)]
                    if len(items) >= min_items:
                        return items
            if min_items <= 1:
                return [parsed]
    except json.JSONDecodeError:
        pass

    start = text.find("[")
    if start != -1:
        end = text.rfind("]")
        slice_text = text[start : end + 1] if end > start else text[start:]
        try:
            parsed = json.loads(slice_text)
            if isinstance(parsed, list):
                items = [x for x in parsed if isinstance(x, dict)]
                if len(items) >= min_items:
                    return items
        except json.JSONDecodeError:
            pass

        salvaged = _salvage_objects_from_array_slice(slice_text[1:] if slice_text.startswith("[") else slice_text)
        if len(salvaged) >= min_items:
            return salvaged

    salvaged = _regex_destination_objects(text)
    if len(salvaged) >= min_items:
        return salvaged

    raise ValueError(f"No JSON array in LLM response: {content[:300]!r}")


def parse_llm_json_object(content: str) -> dict[str, Any]:
    text = strip_code_fences(content)

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    if start != -1:
        end = text.rfind("}")
        if end > start:
            try:
                parsed = json.loads(text[start : end + 1])
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass

        salvaged = _salvage_objects_from_array_slice(text[start:])
        if salvaged:
            return salvaged[0]

    raise ValueError(f"No JSON object in LLM response: {content[:300]!r}")


def is_retryable_llm_error(exc: Exception) -> bool:
    if isinstance(exc, (json.JSONDecodeError, ValueError)):
        return True
    message = str(exc).lower()
    return any(
        token in message
        for token in (
            "429",
            "503",
            "rate",
            "quota",
            "high demand",
            "unavailable",
            "json",
            "truncat",
            "no json",
        )
    )


# Default completion budget — free models often truncate below OpenAI's default.
LLM_MAX_TOKENS = 2048
