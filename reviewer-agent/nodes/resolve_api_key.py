"""Node: Resolve which LLM API key to use for the review."""

import os
from state import ReviewerState


def resolve_api_key(state: ReviewerState) -> dict:
    """
    Priority: poster key (if under limit) → freelancer key → env fallback → none.
    """
    if state.get("error"):
        return {}

    print("  🔑 Resolving LLM API key...")

    # 1. Check poster's key (if auto-review enabled and under limit)
    poster_key = state.get("poster_llm_key") or os.environ.get("POSTER_LLM_KEY")
    poster_provider = state.get("poster_llm_provider") or os.environ.get("POSTER_LLM_PROVIDER", "openrouter")
    poster_max = state.get("poster_max_reviews")
    poster_used = state.get("poster_reviews_used", 0)

    if poster_key:
        if poster_max is None or poster_used < poster_max:
            print(f"  ✅ Using poster's key ({poster_provider})")
            if poster_max:
                print(f"     Reviews: {poster_used + 1}/{poster_max}")
            return {
                "resolved_api_key": poster_key,
                "resolved_provider": poster_provider,
                "key_source": "poster",
            }
        else:
            print(f"  ⚠️  Poster's review limit reached ({poster_used}/{poster_max})")

    # 2. Check freelancer's key
    freelancer_key = state.get("freelancer_llm_key") or os.environ.get("FREELANCER_LLM_KEY")
    freelancer_provider = state.get("freelancer_llm_provider") or os.environ.get("FREELANCER_LLM_PROVIDER", "openrouter")

    if freelancer_key:
        print(f"  ✅ Using freelancer's key ({freelancer_provider})")
        return {
            "resolved_api_key": freelancer_key,
            "resolved_provider": freelancer_provider,
            "key_source": "freelancer",
        }

    # 3. Fallback to environment variable (for demo/testing)
    fallback_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if fallback_key:
        # Determine provider from which env var was set
        if os.environ.get("OPENROUTER_API_KEY"):
            provider = "openrouter"
        elif os.environ.get("ANTHROPIC_API_KEY"):
            provider = "anthropic"
        else:
            provider = "openai"

        print(f"  ✅ Using fallback env key ({provider})")
        return {
            "resolved_api_key": fallback_key,
            "resolved_provider": provider,
            "key_source": "poster",  # Treat env as poster for demo
        }

    # 4. No key available
    print("  ⚠️  No LLM key available — skipping automated review")
    return {
        "resolved_api_key": None,
        "resolved_provider": None,
        "key_source": "none",
    }
