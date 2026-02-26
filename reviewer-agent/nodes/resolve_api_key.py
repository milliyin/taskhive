"""Node: Resolve which LLM API key to use for the review."""

import requests
from state import ReviewerState


def validate_key(api_key: str, provider: str) -> bool:
    """Make a minimal API call to check if the key actually works."""
    try:
        if provider == "openrouter":
            resp = requests.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )
            return resp.status_code == 200

        elif provider == "anthropic":
            resp = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "hi"}],
                },
                timeout=10,
            )
            # 200 = works, 401 = bad key, anything else = might work
            return resp.status_code != 401

        elif provider == "openai":
            resp = requests.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )
            return resp.status_code == 200

        else:
            print(f"  [!!] Unknown provider '{provider}' -- skipping validation")
            return False

    except requests.RequestException as e:
        print(f"  [!!] Key validation failed: {e}")
        return False


def resolve_api_key(state: ReviewerState) -> dict:
    """
    Resolve which LLM key to use.

    Priority:
      1. Poster key -- if auto_review_enabled + key exists + under limit + key works
      2. Freelancer key -- if key exists + key works
      3. None -- skip automated review

    Note: poster's key requires auto_review_enabled (opt-in) to prevent
    spending their API credits without consent. Manual review via the
    "AI Review" button uses a separate route that doesn't check this flag.
    """
    if state.get("error"):
        return {}

    print("  [KEY] Resolving LLM API key...")

    # --- 1. Try poster's key (only if auto_review_enabled on the task) --
    # The poster's key is only used automatically when they opted in.
    # For manual review, the poster clicks "AI Review" button (separate route).
    auto_review = state.get("auto_review_enabled", False)
    poster_key = state.get("poster_llm_key")
    poster_provider = state.get("poster_llm_provider", "openrouter")
    poster_max = state.get("poster_max_reviews")
    poster_used = state.get("poster_reviews_used", 0)

    if auto_review and poster_key:
        under_limit = poster_max is None or poster_used < poster_max
        if under_limit:
            print(f"  [..] Validating poster's key ({poster_provider})...")
            if validate_key(poster_key, poster_provider):
                print(f"  [OK] Using poster's key ({poster_provider})")
                if poster_max is not None:
                    print(f"       Reviews: {poster_used + 1}/{poster_max}")
                return {
                    "resolved_api_key": poster_key,
                    "resolved_provider": poster_provider,
                    "key_source": "poster",
                }
            else:
                print(f"  [!!] Poster's key failed validation -- trying freelancer")
        else:
            print(f"  [!!] Poster's review limit reached ({poster_used}/{poster_max}) -- trying freelancer")
    elif not auto_review and poster_key:
        print("  [--] Poster has key but auto-review not enabled -- trying freelancer")
    else:
        print("  [--] Poster has no LLM key -- trying freelancer")

    # --- 2. Try freelancer's key ------------------------------------
    freelancer_key = state.get("freelancer_llm_key")
    freelancer_provider = state.get("freelancer_llm_provider", "openrouter")

    if freelancer_key:
        print(f"  [..] Validating freelancer's key ({freelancer_provider})...")
        if validate_key(freelancer_key, freelancer_provider):
            print(f"  [OK] Using freelancer's key ({freelancer_provider})")
            return {
                "resolved_api_key": freelancer_key,
                "resolved_provider": freelancer_provider,
                "key_source": "freelancer",
            }
        else:
            print(f"  [!!] Freelancer's key failed validation")

    # --- 3. No key available ----------------------------------------
    print("  [SKIP] No working LLM key available -- skipping automated review")
    return {
        "resolved_api_key": None,
        "resolved_provider": None,
        "key_source": "none",
    }
