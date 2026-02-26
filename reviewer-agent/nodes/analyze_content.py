"""Node: Use LLM to analyze deliverable content against task requirements."""

import json
import requests
from datetime import datetime, timezone
from state import ReviewerState


REVIEW_PROMPT = """You are a strict code/content reviewer for the TaskHive platform.
You must evaluate a deliverable submission against the task requirements.

## Task
**Title:** {title}
**Description:** {description}
**Requirements:** {requirements}

## Submitted Deliverable (Revision #{revision})
```
{content}
```

{files_section}

{preview_section}

## Your Job
Evaluate whether this deliverable FULLY meets ALL task requirements. Be strict:
- If ANY requirement is not met, the verdict is FAIL
- 90% completion is still FAIL
- The task either meets the spec or it doesn't
- If a live preview URL or HTML files are provided, consider whether the deployed site appears complete

## Response Format
Respond ONLY with valid JSON (no markdown, no backticks):
{{
  "verdict": "pass" or "fail",
  "feedback": "Detailed explanation of what was done well and what's missing. Be specific and actionable.",
  "scores": {{
    "requirements_met": <1-10>,
    "code_quality": <1-10>,
    "completeness": <1-10>,
    "documentation": <1-10>
  }},
  "missing_requirements": ["list of specific unmet requirements, empty if pass"]
}}
"""


def call_openrouter(api_key: str, prompt: str, model: str = "anthropic/claude-sonnet-4-20250514") -> dict:
    """Call OpenRouter API."""
    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 2000,
            "temperature": 0.1,
        },
        timeout=60,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    return json.loads(content.strip().removeprefix("```json").removesuffix("```").strip())


def call_anthropic(api_key: str, prompt: str, model: str = "claude-sonnet-4-20250514") -> dict:
    """Call Anthropic API directly."""
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": 2000,
            "temperature": 0.1,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=60,
    )
    resp.raise_for_status()
    content = resp.json()["content"][0]["text"]
    return json.loads(content.strip().removeprefix("```json").removesuffix("```").strip())


def call_openai(api_key: str, prompt: str, model: str = "gpt-4o") -> dict:
    """Call OpenAI API."""
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 2000,
            "temperature": 0.1,
        },
        timeout=60,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    return json.loads(content.strip().removeprefix("```json").removesuffix("```").strip())


def analyze_content(state: ReviewerState) -> dict:
    """Send deliverable to LLM for review."""
    if state.get("error"):
        return {}

    # Skip if no key
    if state.get("key_source") == "none" or not state.get("resolved_api_key"):
        print("  [SKIP] Skipping analysis -- no LLM key")
        return {
            "verdict": "skipped",
            "feedback": "No LLM API key available. Manual review required.",
            "scores": {},
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }

    print(f"  [AI] Analyzing deliverable with {state['resolved_provider']}...")

    # Build files section
    files_section = ""
    files = state.get("deliverable_files") or []
    if files:
        file_list = "\n".join(f"- {f.get('name', '?')} ({f.get('file_type', '?')}): {f.get('public_url', 'N/A')}" for f in files[:10])
        files_section = f"## Submitted Files\n{file_list}"

    # Build preview section
    preview_section = ""
    preview_url = state.get("deliverable_preview_url")
    if preview_url:
        preview_section = f"## Live Preview\nDeployed at: {preview_url}"

    # Build prompt
    prompt = REVIEW_PROMPT.format(
        title=state.get("task_title", ""),
        description=state.get("task_description", ""),
        requirements=state.get("task_requirements", "No specific requirements listed"),
        revision=state.get("deliverable_revision_number", 1),
        content=state.get("deliverable_content", "")[:15000],  # Truncate for token limits
        files_section=files_section,
        preview_section=preview_section,
    )

    provider = state["resolved_provider"]
    api_key = state["resolved_api_key"]

    try:
        if provider == "openrouter":
            model = "anthropic/claude-sonnet-4-20250514"
            result = call_openrouter(api_key, prompt, model)
        elif provider == "anthropic":
            model = "claude-sonnet-4-20250514"
            result = call_anthropic(api_key, prompt, model)
        elif provider == "openai":
            model = "gpt-4o"
            result = call_openai(api_key, prompt, model)
        else:
            return {"error": f"Unknown provider: {provider}"}

        verdict = result.get("verdict", "fail").lower()
        feedback = result.get("feedback", "No feedback provided")
        scores = result.get("scores", {})
        missing = result.get("missing_requirements", [])

        print(f"  {'[PASS]' if verdict == 'pass' else '[FAIL]'}")
        print(f"       Scores: {json.dumps(scores)}")
        if missing:
            print(f"       Missing: {', '.join(missing)}")

        return {
            "verdict": verdict,
            "feedback": feedback,
            "scores": scores,
            "llm_model_used": f"{provider}/{model}",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }

    except json.JSONDecodeError as e:
        print(f"  [!!] Failed to parse LLM response: {e}")
        return {
            "verdict": "fail",
            "feedback": "Reviewer agent could not parse LLM response. Please review manually.",
            "scores": {},
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "llm_model_used": f"{provider}/error",
        }
    except requests.RequestException as e:
        print(f"  [!!] LLM API error: {e}")
        return {
            "error": f"LLM API error: {str(e)}",
        }
