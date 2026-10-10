"""Manual check for is_retryable_llm_error. Run: python scripts/test_llm_retry.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.llm_json import is_retryable_llm_error


class _HttpError(Exception):
    def __init__(self, status_code: int, message: str = "") -> None:
        super().__init__(message or f"HTTP {status_code}")
        self.status_code = status_code


def _check(label: str, exc: Exception, expected: bool) -> None:
    got = is_retryable_llm_error(exc)
    if got != expected:
        raise AssertionError(f"{label}: expected retry={expected}, got {got} ({exc!r})")


def main() -> None:
    for code in (429, 500, 502, 503, 529):
        _check(f"HTTP {code}", _HttpError(code), True)

    _check("overloaded message", Exception("The model is overloaded"), True)
    _check("temporarily unavailable", Exception("Service temporarily unavailable"), True)
    _check("generateContent 404 text", Exception("404 model generateContent not found"), False)

    _check("HTTP 404", _HttpError(404, "model not found"), False)
    _check("HTTP 400", _HttpError(400, "bad request"), False)

    _check("quota in message", Exception("exceeded quota"), True)
    _check("high demand", Exception("high demand, try later"), True)

    print("OK — all is_retryable_llm_error cases passed")


if __name__ == "__main__":
    main()
