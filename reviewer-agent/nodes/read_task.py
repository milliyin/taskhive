"""Node: Fetch task details and review config from TaskHive API."""

import requests
from state import ReviewerState


def read_task(state: ReviewerState) -> dict:
    """Fetch task details including requirements and auto-review settings + decrypted LLM keys."""
    print(f"  📋 Fetching task #{state['task_id']}...")

    base_url = state["taskhive_url"]
    headers = {"Authorization": f"Bearer {state['taskhive_api_key']}"}

    # 1. Fetch task details
    resp = requests.get(f"{base_url}/api/v1/tasks/{state['task_id']}", headers=headers, timeout=15)

    if resp.status_code != 200:
        error_data = resp.json()
        return {
            "error": f"Failed to fetch task: {error_data.get('error', {}).get('message', resp.status_code)}"
        }

    data = resp.json()["data"]

    print(f"  ✅ Task: \"{data['title']}\"")
    print(f"     Budget: {data['budget_credits']} credits | Max revisions: {data['max_revisions']}")
    print(f"     Auto-review: {data.get('auto_review_enabled', False)}")

    result = {
        "task_title": data["title"],
        "task_description": data["description"],
        "task_requirements": data.get("requirements", ""),
        "task_budget": data["budget_credits"],
        "task_max_revisions": data["max_revisions"],
        "task_poster_id": data.get("poster", {}).get("id"),
        "task_claimed_by_agent_id": data.get("claimed_by_agent_id"),
        # Auto-review fields from task details
        "auto_review_enabled": data.get("auto_review_enabled", False),
        "poster_max_reviews": data.get("poster_max_reviews"),
        "poster_reviews_used": data.get("poster_reviews_used", 0),
    }

    # 2. Fetch review config (decrypted LLM keys)
    config_resp = requests.get(
        f"{base_url}/api/v1/tasks/{state['task_id']}/review-config",
        headers=headers,
        timeout=15,
    )

    if config_resp.status_code == 200:
        config = config_resp.json().get("data", {})

        poster_key = config.get("poster_llm_key")
        freelancer_key = config.get("freelancer_llm_key")

        if poster_key:
            result["poster_llm_key"] = poster_key
            result["poster_llm_provider"] = config.get("poster_llm_provider")
            print(f"     Poster LLM key: ✅ ({config.get('poster_llm_provider')})")
        else:
            print("     Poster LLM key: not set")

        if freelancer_key:
            result["freelancer_llm_key"] = freelancer_key
            result["freelancer_llm_provider"] = config.get("freelancer_llm_provider")
            print(f"     Freelancer LLM key: ✅ ({config.get('freelancer_llm_provider')})")
        else:
            print("     Freelancer LLM key: not set")

        # Update review counters from config
        result["poster_max_reviews"] = config.get("poster_max_reviews")
        result["poster_reviews_used"] = config.get("poster_reviews_used", 0)
    else:
        print(f"  ⚠️  Could not fetch review config ({config_resp.status_code}) — using env fallback")

    return result
