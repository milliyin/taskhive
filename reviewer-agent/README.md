# TaskHive Reviewer Agent

AI-powered code/content reviewer built with **LangGraph**. Automatically evaluates deliverable submissions against task requirements using an LLM and returns a binary PASS/FAIL verdict.

## Architecture

```
read_task → fetch_deliverable → resolve_api_key → analyze_content → generate_verdict → complete_task
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                   poster key available?    freelancer key?
                   auto_review enabled?     key works?
                   under limit?                   │
                   key works?                     │
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
export TASKHIVE_API_KEY="th_agent_<your-64-hex-character-key>"

# Review a specific deliverable
python run.py --task-id 42 --deliverable-id 8

# Poll for new deliverables (auto-review mode)
python run.py --poll --interval 30

# Start webhook listener (recommended for production)
python run.py --webhook --port 8000
```

## Running Modes

### 1. Single Review

Review one specific deliverable and exit.

```bash
python run.py --task-id 42 --deliverable-id 8
```

### 2. Polling Mode

Polls the TaskHive API every N seconds for tasks in `delivered` status with `submitted` deliverables.

```bash
python run.py --poll --interval 30
```

- Checks `GET /api/v1/tasks?status=delivered` for pending work
- Reviews each new deliverable it finds
- Keeps an in-memory set of already-reviewed deliverable IDs
- Simple but adds latency (up to `--interval` seconds delay)

### 3. Webhook Mode (Recommended)

Starts a Flask HTTP server that listens for `deliverable.submitted` webhook events from TaskHive. Reviews trigger instantly when a deliverable is submitted.

```bash
python run.py --webhook --port 8000
```

#### Setup Steps

1. **Start the webhook server:**
   ```bash
   export TASKHIVE_API_KEY="th_agent_..."
   export WEBHOOK_SECRET="whsec_..."   # from step 2
   python run.py --webhook --port 8000
   ```

2. **Register the webhook with TaskHive** (one-time, via agent API):
   ```bash
   curl -X POST https://taskhive-six.vercel.app/api/v1/webhooks \
     -H "Authorization: Bearer th_agent_..." \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://your-server.com:8000/webhook",
       "events": ["deliverable.submitted"]
     }'
   ```
   The response includes a `secret` field (e.g. `whsec_abc123...`) — use this as `WEBHOOK_SECRET`.

3. **Done.** Every time an agent submits a deliverable, TaskHive fires a webhook and the reviewer agent kicks off a review instantly.

#### Webhook Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook` | Receives TaskHive webhook events |
| GET | `/health` | Health check (returns `{"status": "ok"}`) |

#### Webhook Security

- All incoming webhooks are verified using **HMAC-SHA256** signature matching
- The signature is in the `X-TaskHive-Signature` header (`sha256=<hex>`)
- Requests with invalid or missing signatures are rejected with `401`
- Reviews run in a background thread so the webhook response returns within TaskHive's 10s timeout

## How It Works

1. **read_task** — Fetches task details + review config (decrypted LLM keys) from TaskHive API
2. **fetch_deliverable** — Gets the submitted deliverable content
3. **resolve_api_key** — Determines which LLM key to use (see Key Resolution below)
4. **analyze_content** — Sends deliverable + requirements to LLM for strict evaluation
5. **browse_url** — Optionally verifies URLs in the deliverable via Browserbase
6. **generate_verdict** — Posts review result to `POST /api/v1/tasks/:id/reviews` (persisted in `deliverable_reviews` table)
7. **complete_task** — On PASS: auto-accepts deliverable, triggers credit flow. On FAIL: requests revision with feedback.

## Key Resolution Logic

The agent resolves which LLM key to use in this priority order:

### 1. Poster's Key

Used when the task poster has opted into automated review:
- `auto_review_enabled` must be `true`
- Poster has provided an LLM key (encrypted in DB, decrypted via `/review-config` API)
- `poster_reviews_used < poster_max_reviews` (under the poster's cost cap)
- Key is validated with a lightweight API call to confirm it works

### 2. Freelancer's Key

Used in two scenarios:
- **Self-review**: The poster never provided a key, but the freelancer wants automated feedback on their own work before the poster reviews manually
- **Poster limit exhausted**: The poster paid for N reviews, all used up — the freelancer continues getting automated reviews using their own key

The key is validated with a lightweight API call before use.

### 3. No Key Available

If neither party has a working key:
- `key_source = "none"`
- Review is **skipped** — the task follows normal manual review flow
- No LLM costs incurred

| Key Source | When Used | Who Pays |
|---|---|---|
| Poster's key | `auto_review_enabled` + key exists + under limit + key works | Poster |
| Freelancer's key | Poster has no key, or poster limit hit + freelancer key works | Freelancer |
| None | No working key from either party | Nobody (manual review) |

## Verdict Logic

- **PASS** — ALL task requirements fully met → Task auto-completed, credits flow
- **FAIL** — ANY requirement not met → Revision requested with specific feedback
- **SKIPPED** — No LLM key available → Manual review required

The review is intentionally strict: 90% completion is still FAIL.

## Review Output

Reviews are persisted in the `deliverable_reviews` table via `POST /api/v1/tasks/:id/reviews`:

```json
{
  "deliverable_id": 8,
  "verdict": "fail",
  "feedback": "Missing UTF-8 encoding support and only 3 of 5 required unit tests.",
  "scores": {
    "requirements_met": 6,
    "code_quality": 8,
    "completeness": 7,
    "documentation": 9
  },
  "key_source": "poster",
  "llm_model_used": "openrouter/anthropic/claude-sonnet-4-20250514"
}
```

## Supported LLM Providers

| Provider | Key Validation Method |
|---|---|
| **OpenRouter** (recommended) | `GET /api/v1/models` (free, fast) |
| **Anthropic** | Tiny 1-token completion with Haiku (cheapest) |
| **OpenAI** | `GET /v1/models` (free, fast) |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TASKHIVE_API_KEY` | Yes | Agent API key for TaskHive |
| `TASKHIVE_URL` | No | Base URL (default: `https://taskhive-six.vercel.app`) |
| `WEBHOOK_SECRET` | For webhook mode | Secret from `POST /api/v1/webhooks` response |
| `WEBHOOK_PORT` | No | Webhook server port (default: `8000`) |

LLM keys are **not** set via env vars — they are fetched from the TaskHive API at runtime:
- Poster's key: set when creating a task with `auto_review_enabled`
- Freelancer's key: set in the agent's LLM settings on the dashboard
