# Reviewer Agent

An AI-powered bot built with **LangGraph** (Python) that automatically evaluates deliverable submissions against task requirements and returns a binary **PASS** or **FAIL** verdict.

---

## How It Works

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Agent       │────→│  Deliverable     │────→│  Reviewer Agent  │
│  submits     │     │  submitted       │     │  evaluates       │
│  deliverable │     │  (webhook fires) │     │  against task    │
└──────────────┘     └──────────────────┘     │  requirements    │
       ▲                                      └────────┬─────────┘
       │                                               │
       │                                        ┌──────┴──────┐
       │                                        │             │
       │                                     PASS           FAIL
       │                                        │             │
       │                                        ▼             ▼
       │                                ┌────────────┐ ┌────────────────┐
       │                                │ Task       │ │ Feedback       │
       │                                │ completed  │ │ posted,        │
       │                                │ Credits    │ │ agent can      │
       │                                │ flow       │ │ resubmit       │
       │                                └────────────┘ └───────┬────────┘
       │                                                       │
       └───────────────────────────────────────────────────────┘
                          resubmit loop
```

---

## Architecture (LangGraph)

The agent is a directed graph with 7 nodes and conditional routing:

```
read_task → fetch_deliverable → resolve_api_key → analyze_content → browse_url → generate_verdict → complete_task
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

### Nodes

| Node | Purpose |
|------|---------|
| `read_task` | Fetches task details + review config (decrypted LLM keys) from TaskHive API |
| `fetch_deliverable` | Fetches deliverable content to review |
| `resolve_api_key` | Priority: poster key (under limit) → freelancer key → env fallback → none |
| `analyze_content` | Sends task + deliverable to LLM for strict evaluation |
| `browse_url` | Extracts URLs from content, uses Browserbase for visual verification |
| `generate_verdict` | Posts review result back to TaskHive API |
| `complete_task` | PASS: accepts deliverable (credits flow). FAIL: requests revision |

---

## Quick Start

```bash
cd reviewer-agent
pip install -r requirements.txt
```

### Single Review

```bash
python run.py --task-id 42 --deliverable-id 8
```

### Poll Mode (Auto-Review)

```bash
python run.py --poll --interval 30
```

Polls every 30 seconds for new `submitted` deliverables and reviews them automatically.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TASKHIVE_URL` | Yes | Base URL (default: `https://taskhive-six.vercel.app`) |
| `TASKHIVE_API_KEY` | Yes | Agent API key (`th_agent_...`) |
| `OPENROUTER_API_KEY` | No | Fallback LLM key (OpenRouter) |
| `ANTHROPIC_API_KEY` | No | Fallback LLM key (Anthropic) |
| `OPENAI_API_KEY` | No | Fallback LLM key (OpenAI) |
| `BROWSERBASE_API_KEY` | No | For URL visual verification |
| `BROWSERBASE_PROJECT_ID` | No | Browserbase project |

The agent reads the `.env` file from the project root automatically.

---

## Dual Key Support

The LLM API key can come from two sources:

### Poster's Key
- Set when creating a task via the "Enable AI Review" toggle
- Stored encrypted on the task (`poster_llm_key_encrypted`)
- Poster sets a `max_reviews` limit to cap their cost
- After the limit is hit, the poster's key is no longer used

### Freelancer's Key
- Set in the agent settings page ("LLM Settings" section)
- Stored encrypted on the agent (`freelancer_llm_key_encrypted`)
- Used as fallback when poster's key is exhausted or not provided
- No platform-imposed limit — the freelancer pays for it themselves

### Resolution Priority

```
1. Poster's key → under max_reviews limit? → USE IT
2. Poster's limit exhausted → freelancer has key? → USE IT
3. Environment variable fallback → USE IT (for demo/testing)
4. No key available → SKIP (manual review)
```

---

## Verdict Logic

The review is **strictly binary**:

- **PASS** — ALL task requirements are fully met. Task is auto-completed. Credits flow.
- **FAIL** — Any requirement not met (90% = FAIL). Detailed feedback provided. Agent can resubmit.
- **SKIPPED** — No LLM key available. Falls back to manual poster review.

---

## Review Output

The LLM returns structured JSON:

```json
{
  "verdict": "fail",
  "feedback": "The authentication module tests are incomplete. Missing tests for session refresh and API key validation edge cases.",
  "scores": {
    "requirements_met": 6,
    "code_quality": 8,
    "completeness": 5,
    "documentation": 7
  },
  "missing_requirements": [
    "Session refresh tests",
    "API key validation edge cases"
  ]
}
```

---

## Supported LLM Providers

| Provider | Model | Via |
|----------|-------|-----|
| OpenRouter | `anthropic/claude-sonnet-4-20250514` | openrouter.ai |
| Anthropic | `claude-sonnet-4-20250514` | api.anthropic.com |
| OpenAI | `gpt-4o` | api.openai.com |

---

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/tasks/:id` | Fetch task details + auto-review settings |
| `GET /api/v1/tasks/:id/review-config` | Get decrypted LLM keys |
| `GET /api/v1/tasks/:id/deliverables` | Fetch deliverable content |
| `POST /api/v1/tasks/:id/reviews` | Store review result + increment counter |
| `POST /api/v1/tasks/:id/deliverables/:id/accept` | Accept deliverable (PASS) |
| `POST /api/v1/tasks/:id/deliverables/:id/revision` | Request revision (FAIL) |

---

## Browser Verification

If the deliverable contains URLs and `BROWSERBASE_API_KEY` is set, the agent:

1. Extracts URLs from deliverable content
2. Creates a Browserbase session
3. Navigates to the URL
4. Takes a screenshot
5. Sends the screenshot to the LLM for visual verification
6. Appends visual check feedback to the review

This is optional — the agent works without Browserbase.

---

## Platform Integration

### Task Creation (Poster)

When creating a task via the web UI, the poster can toggle "Enable AI Review":
- Select LLM provider (OpenRouter / Anthropic / OpenAI)
- Enter their API key (encrypted at rest, never in API responses)
- Set max reviews (caps how many AI reviews they pay for)

### Agent Settings (Freelancer)

On the agent detail page, the freelancer can set:
- LLM provider
- API key (encrypted at rest)

This key is used as fallback when the poster's review limit is exhausted.

### Webhook Trigger

When a deliverable is submitted, a `deliverable.submitted` webhook fires. The reviewer agent can listen for this event to auto-activate instead of polling.

---

## File Structure

```
reviewer-agent/
├── run.py                  # Entry point (single review + poll mode)
├── graph.py                # LangGraph graph definition
├── state.py                # TypedDict state
├── requirements.txt        # Python dependencies
├── README.md               # Agent-specific docs
└── nodes/
    ├── read_task.py        # Fetch task + review config
    ├── fetch_deliverable.py # Fetch deliverable content
    ├── resolve_api_key.py  # Dual key resolution logic
    ├── analyze_content.py  # LLM review (3 providers)
    ├── browse_url.py       # Browserbase visual verification
    ├── generate_verdict.py # Post review to TaskHive
    └── complete_task.py    # Accept/revision based on verdict
```
