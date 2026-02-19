"""Node: Browse submitted URL using Browserbase and verify it works."""

import re
import os
import base64
import requests
from state import ReviewerState


# Regex to find URLs in deliverable content
URL_PATTERN = re.compile(r'https?://[^\s\'"<>\)\]]+')


def extract_urls(content: str) -> list[str]:
    """Extract URLs from deliverable content."""
    urls = URL_PATTERN.findall(content)
    # Filter out common non-deliverable URLs
    skip = ["github.com/anthropic", "api.anthropic.com", "openrouter.ai", "localhost"]
    return [u for u in urls if not any(s in u for s in skip)]


def browse_url(state: ReviewerState) -> dict:
    """
    If deliverable contains a URL, use Browserbase to navigate and screenshot.
    Sends screenshot to LLM for visual verification.
    Skips gracefully if BROWSERBASE_API_KEY is not set.
    """
    if state.get("error"):
        return {}

    content = state.get("deliverable_content", "")
    urls = extract_urls(content)

    if not urls:
        print("  🔗 No URLs found in deliverable — skipping browser check")
        return {}

    api_key = os.environ.get("BROWSERBASE_API_KEY")
    project_id = os.environ.get("BROWSERBASE_PROJECT_ID")

    if not api_key or not project_id:
        print("  🔗 URLs found but BROWSERBASE_API_KEY not set — skipping browser verification")
        print(f"     URLs detected: {', '.join(urls[:3])}")
        return {}

    target_url = urls[0]
    print(f"  🌐 Browsing: {target_url}")

    try:
        # 1. Create a Browserbase session
        session_resp = requests.post(
            "https://www.browserbase.com/v1/sessions",
            headers={
                "x-bb-api-key": api_key,
                "Content-Type": "application/json",
            },
            json={
                "projectId": project_id,
            },
            timeout=30,
        )
        session_resp.raise_for_status()
        session = session_resp.json()
        session_id = session["id"]
        connect_url = session.get("connectUrl", f"wss://connect.browserbase.com?sessionId={session_id}")

        print(f"  ✅ Browserbase session created: {session_id}")

        # 2. Navigate and take screenshot via Browserbase debug endpoint
        # Use the session's live URLs endpoint to navigate
        nav_resp = requests.post(
            f"https://www.browserbase.com/v1/sessions/{session_id}/navigate",
            headers={
                "x-bb-api-key": api_key,
                "Content-Type": "application/json",
            },
            json={
                "url": target_url,
                "waitUntil": "networkidle",
                "timeout": 15000,
            },
            timeout=30,
        )

        # 3. Take screenshot
        screenshot_resp = requests.get(
            f"https://www.browserbase.com/v1/sessions/{session_id}/screenshot",
            headers={
                "x-bb-api-key": api_key,
            },
            timeout=30,
        )

        screenshot_b64 = None
        page_title = "Unknown"
        page_loaded = False

        if screenshot_resp.status_code == 200:
            content_type = screenshot_resp.headers.get("content-type", "")
            if "image" in content_type:
                screenshot_b64 = base64.b64encode(screenshot_resp.content).decode("utf-8")
                page_loaded = True
                print(f"  📸 Screenshot captured ({len(screenshot_resp.content)} bytes)")
            elif "json" in content_type:
                data = screenshot_resp.json()
                screenshot_b64 = data.get("screenshot") or data.get("data")
                page_loaded = bool(screenshot_b64)

        # 4. Close session
        try:
            requests.post(
                f"https://www.browserbase.com/v1/sessions/{session_id}/stop",
                headers={"x-bb-api-key": api_key},
                timeout=10,
            )
        except Exception:
            pass

        if not page_loaded:
            print(f"  ❌ Page failed to load: {target_url}")
            return {
                "feedback": (state.get("feedback", "") +
                             f"\n\n[Browser Check] URL {target_url} failed to load."),
            }

        # 5. Send screenshot to LLM for visual verification (if we have a key)
        llm_key = state.get("resolved_api_key")
        provider = state.get("resolved_provider")

        if llm_key and provider and screenshot_b64:
            print("  🤖 Sending screenshot to LLM for visual verification...")

            visual_feedback = verify_screenshot_with_llm(
                llm_key, provider, screenshot_b64, target_url,
                state.get("task_title", ""),
                state.get("task_description", ""),
            )

            existing_feedback = state.get("feedback", "")
            return {
                "feedback": f"{existing_feedback}\n\n[Browser Check] {visual_feedback}",
            }

        print(f"  ✅ Page loaded successfully: {target_url}")
        existing_feedback = state.get("feedback", "")
        return {
            "feedback": f"{existing_feedback}\n\n[Browser Check] URL {target_url} loaded successfully.",
        }

    except requests.RequestException as e:
        print(f"  ⚠️  Browserbase error: {e}")
        return {}
    except Exception as e:
        print(f"  ⚠️  Browser check error: {e}")
        return {}


def verify_screenshot_with_llm(
    api_key: str, provider: str, screenshot_b64: str,
    url: str, task_title: str, task_description: str,
) -> str:
    """Send screenshot to LLM to verify it matches task requirements."""

    prompt = (
        f"I navigated to {url} which was submitted as a deliverable for this task:\n"
        f"Title: {task_title}\n"
        f"Description: {task_description}\n\n"
        "Here is a screenshot of the page. Does it appear to be working and relevant "
        "to the task? Respond in 2-3 sentences."
    )

    try:
        if provider == "anthropic":
            resp = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 300,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": screenshot_b64,
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }],
                },
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["content"][0]["text"]

        elif provider == "openrouter":
            resp = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "anthropic/claude-sonnet-4-20250514",
                    "messages": [{
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{screenshot_b64}"},
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }],
                    "max_tokens": 300,
                },
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

        elif provider == "openai":
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o",
                    "messages": [{
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{screenshot_b64}"},
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }],
                    "max_tokens": 300,
                },
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    except Exception as e:
        return f"Could not verify screenshot with LLM: {e}"

    return "Browser check completed but LLM verification unavailable."
