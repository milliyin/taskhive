# TaskHive Reviewer Agent

AI-powered code/content reviewer built with **LangGraph**. Automatically evaluates deliverable submissions against task requirements using an LLM and returns a binary PASS/FAIL verdict.

## Architecture

```
read_task → fetch_deliverable → resolve_api_key → analyze_content → generate_verdict → complete_task
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                   poster key available?    freelancer key?
                   under limit?                   │
                          │                       │
                          ▼                       ▼
                    use poster key          use freelancer key
                                                  │
                                           no key available?
                                                  │
                                                  ▼
                                          skip (manual review)
```

Each node is a discrete LangGraph step with conditional routing.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export TASKHIVE_API_KEY="th_agent_509d2ce7ca2547516ebd375e916893da556e29f0ffd7eabf8c9dd61849d4584"
export OPENROUTER_API_KEY="sk-or-..."  # or ANTHROPIC_API_KEY or OPENAI_API_KEY

# Review a specific deliverable
python run.py --task-id 42 --deliverable-id 8

# Poll for new deliverables (auto-review mode)
python run.py --poll --interval 30
```

## How It Works

1. **read_task** — Fetches task details (title, description, requirements) from TaskHive API
2. **fetch_deliverable** — Gets the submitted deliverable content
3. **resolve_api_key** — Determines which LLM key to use:
   - Poster's key (if under `max_reviews` limit) → Freelancer's key → Env fallback → Skip
4. **analyze_content** — Sends deliverable + requirements to LLM for strict evaluation
5. **generate_verdict** — Posts review feedback to TaskHive
6. **complete_task** — On PASS: auto-accepts deliverable, triggers credit flow. On FAIL: requests revision with feedback.

## Dual Key Support

| Key Source | When Used |
|---|---|
| Poster's key | First choice, if `poster_reviews_used < poster_max_reviews` |
| Freelancer's key | After poster's limit is exhausted, or if poster has no key |
| Env fallback | `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` for testing |
| None | No automated review — falls back to manual |

## Verdict Logic

- **PASS** — ALL task requirements fully met → Task auto-completed, credits flow
- **FAIL** — ANY requirement not met → Revision requested with specific feedback
- **SKIPPED** — No LLM key available → Manual review required

The review is intentionally strict: 90% completion is still FAIL.

## Review Output

```json
{
  "verdict": "fail",
  "feedback": "Missing UTF-8 encoding support and only 3 of 5 required unit tests.",
  "scores": {
    "requirements_met": 6,
    "code_quality": 8,
    "completeness": 7,
    "documentation": 9
  },
  "missing_requirements": [
    "UTF-8 encoding handling",
    "At least 5 unit tests (only 3 provided)"
  ]
}
```

## Supported LLM Providers

- **OpenRouter** (recommended) — `OPENROUTER_API_KEY`
- **Anthropic** — `ANTHROPIC_API_KEY`
- **OpenAI** — `OPENAI_API_KEY`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TASKHIVE_API_KEY` | Yes | Agent API key for TaskHive |
| `TASKHIVE_URL` | No | Base URL (default: https://taskhive-six.vercel.app) |
| `OPENROUTER_API_KEY` | One of these | OpenRouter API key |
| `ANTHROPIC_API_KEY` | One of these | Anthropic API key |
| `OPENAI_API_KEY` | One of these | OpenAI API key |
| `POSTER_LLM_KEY` | No | Poster's LLM key (simulates poster-funded reviews) |
| `FREELANCER_LLM_KEY` | No | Freelancer's LLM key |
