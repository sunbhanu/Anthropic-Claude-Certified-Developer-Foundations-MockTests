# Claude Certified Developer – Foundations (CCDV-F) Mock Exam Simulator — Shared Spec

Static offline website. Opens by double-clicking `index.html` (file:// protocol). NO server, NO fetch/XHR,
NO ES modules, NO CDN, NO web fonts, NO internet, NO database, NO LLM. Plain HTML + CSS + vanilla JS only.
localStorage may be used for in-progress state and attempt history.

## Real exam facts (from the official Exam Guide v1.0, July 2026)
- Exam code CCDV-F, 53 items, 120 minutes, proctored (Pearson VUE).
- Item formats: multiple-choice (one answer) and multiple-response; each multiple-response item states how many
  responses to select (e.g. "(Select TWO.)").
- Scaled score 100–1,000, passing score 720. Result: pass/fail + scaled score + percent correct per domain.
- Domains & weights → questions per 53-item mock paper (MUST match exactly):
  | Code | Domain | Weight | Qs/paper |
  |---|---|---|---|
  | D1 | Agents and Workflows | 14.7% | 8 |
  | D2 | Applications and Integration | 33.1% | 17 |
  | D3 | Claude Code | 3.1% | 2 |
  | D4 | Eval, Testing, and Debugging | 2.6% | 1 |
  | D5 | Model Selection and Optimization | 16.8% | 9 |
  | D6 | Prompt and Context Engineering | 11.0% | 6 |
  | D7 | Security and Safety | 8.1% | 4 |
  | D8 | Tools and MCPs | 10.6% | 6 |

### Skills per domain (official)
- D1: Agent Architecture (workflow vs agent decision criteria, manager/supervisor hierarchies, subagents);
  Agent Construction (Claude Agent SDK, custom agent loops/harnesses, self-hosted vs Anthropic-hosted deployment,
  hooks for deterministic actions); Agent Patterns & Frameworks (tool-use loops, sub-agents, memory, context-window
  management, Strands, LangGraph, PydanticAI).
- D2: Understanding Requirements (functional/infra requirements from business needs); Systems Life Cycle
  (develop/implement/operate/maintain); Claude API Mechanics (messages, tools, streaming, vision, thinking, caching,
  third-party vendors e.g. Bedrock/Vertex, batch API, realtime vs batch); Software Engineering Foundations (REST,
  JSON, async programming, version control, SDLC, code review, refactoring); Claude Application Design (how Claude
  interprets instructions across Claude Code/Desktop/claude.ai/API/SDKs, content boundaries, schema design, session
  hygiene, plugin management); Configuration Management (CLAUDE.md, settings.json, model version pinning, prompt
  versioning, plugin dependencies).
- D3: Claude Code Operation (Rules, Skills, Commands, Agents, Agent Memory; session management, built-in & custom
  slash commands, headless mode, streaming mode, auto-mode; CLAUDE.md hierarchy; repo initialization; settings.json).
- D4: Debugging & Error Handling (error type identification, recovery strategy, trace analysis, isolating whether a
  problem originates in the integration layer or the model output).
- D5: LLM Fundamentals (tokens, context windows, sampling, non-determinism, next-token generation; fast mode,
  extended thinking, adaptive thinking, effort levels; zero/single/multi-shot); Technical Fundamentals (SDKs wrapping
  REST APIs, websockets, SSE); Model Selection & Tradeoffs (Opus vs Sonnet vs Haiku, quality/latency/cost, breaking
  behavior changes across model releases); Cost & Token Management (usage tracking, cost modeling, prompt caching,
  cache check-pointing).
- D6: Context Engineering (context window management, drift/bloat prevention via tool-output pruning & compaction,
  isolation via subagents); Prompt Engineering (clarity, few-shot, system vs user placement, output constraints,
  iterative refinement, input sanitization); Output Handling (structured output, response validation, defensive
  parsing, skepticism toward confident output).
- D7: AI Application Security (prompt injection, jailbreaks, untrusted input, data leakage, PII, authN/authZ);
  Guardrails & Safe Deployment (content policy, guardrail layering, least privilege, IAM); Claude Hooks (prevent
  destructive actions); Identity, Secrets & Key Management (API keys/credentials across dev & prod).
- D8: Tool Implementation (function calling, tool descriptions, error handling, harness dispatch, client-side vs
  server-side tools, approval patterns, tool-set construction); MCP Server Development (authoring, deployment,
  resources/tools/prompts, stdio vs remote transports); Agentic Customization (built-in tools vs custom tools vs
  Skills vs MCP tradeoffs).

## Knowledge base (use for accurate answers — do not invent API facts beyond this unless certain)
API mechanics
- Messages API: `model`, `max_tokens` (required), `messages` alternating user/assistant, top-level `system` param
  (not a "system" role message). Stateless — the client must resend conversation history each call.
- `stop_reason`: `end_turn`, `max_tokens` (output truncated — raise max_tokens or continue), `stop_sequence`,
  `tool_use` (execute tools, return `tool_result`), `pause_turn` (long server-tool turn; send response back to
  continue), `refusal`.
- Errors: 400 invalid_request_error, 401 authentication_error, 403 permission_error, 404 not_found_error,
  413 request_too_large, 429 rate_limit_error (honor `retry-after`), 500 api_error, 529 overloaded_error.
  Retry 429/500/529 with exponential backoff + jitter; never blindly retry 400/401/403. Official SDKs auto-retry
  (default 2 retries) and expose `max_retries`/timeouts. Rate limits are RPM, input-tokens/min, output-tokens/min,
  reported via `anthropic-ratelimit-*` response headers. Include `request-id` header value in support tickets/logs.
- Streaming (`stream: true`) uses Server-Sent Events: `message_start`, `content_block_start`,
  `content_block_delta` (text_delta / input_json_delta / thinking_delta), `content_block_stop`, `message_delta`
  (contains stop_reason + usage), `message_stop`, `ping`, and possible mid-stream `error` events (e.g. overloaded).
  Streaming improves time-to-first-token / perceived latency, not total cost. Recommended for long outputs to avoid
  HTTP timeouts. Tool input JSON arrives as partial JSON fragments — accumulate before parsing.
- Tool use: tool definitions = `name`, `description`, `input_schema` (JSON Schema). `tool_choice`: `auto`
  (default; may answer in text), `any` (must use some tool), `{"type":"tool","name":...}` (force a specific tool),
  `none`. `disable_parallel_tool_use`. Claude may emit several tool_use blocks in one response (parallel) — return
  all tool_result blocks in the next single user message, each with matching `tool_use_id`, tool_result blocks
  first in content. Signal failures with `is_error: true` and an informative message so Claude can recover.
  Client tools are executed by your app; server tools (e.g. web search, web fetch, code execution) are executed by
  Anthropic. `strict: true` on tools / structured outputs constrain to schema.
- Structured output: structured outputs / strict tool use guarantee schema-shaped JSON but NOT semantic correctness
  → still validate business rules; handle `refusal` and `max_tokens` truncation. Defensive parsing: never `eval`
  model output; validate with a schema (Pydantic/Zod), bounded retry with the validation error fed back, then route
  to human/fallback.
- Vision/PDF: images as base64, URL, or Files API `file_id`; PDFs as `document` blocks. Place images/documents
  before the question text. Images consume tokens proportional to size — resize large images.
- Extended thinking: `thinking: {type:"enabled", budget_tokens:N}` (min 1024, below max_tokens). Thinking tokens
  are billed as output tokens. With tool use, pass thinking blocks back unmodified (signature) within the same
  assistant turn. Incompatible with forced tool_choice (`any`/specific tool) and with modifying temperature/top_k.
  Adaptive thinking (newer models): `thinking: {type:"adaptive"}` where the model decides how much to think,
  steered by the `effort` parameter (low/medium/high/max) which trades quality vs tokens/latency. Fast mode (newer
  Opus) = faster output generation at premium price. Interleaved thinking lets the model think between tool calls.
- Prompt caching: `cache_control: {"type":"ephemeral"}` breakpoints (max 4) on stable prefix content; cache prefix
  order is tools → system → messages; any change earlier in the prefix invalidates everything after it. Default TTL
  5 min (refreshed on each hit), optional 1-hour TTL. Cache writes cost more than base input (1.25× for 5-min,
  2× for 1-hour); cache reads cost ~0.1× base input. Minimum cacheable length applies (short prompts aren't
  cached). Monitor `cache_creation_input_tokens` and `cache_read_input_tokens` in `usage`. Put dynamic content
  (timestamps, user question) AFTER cached content. Cache checkpointing in multi-turn: move/add a breakpoint at
  the end of the latest turn so prior turns are read from cache.
- Message Batches API: 50% cost discount, asynchronous, most finish < 1 h, guaranteed processing window up to
  24 h (unfinished requests expire), results retrievable 29 days, `custom_id` per request to correlate results
  (order not guaranteed), up to 100,000 requests / 256 MB per batch, can combine with prompt caching. Not for
  interactive/latency-sensitive use. Resubmit only errored/expired requests.
- Token counting endpoint (`/v1/messages/count_tokens`) to estimate cost/fit before sending. `usage` in responses
  reports input/output tokens — log it per request/feature/tenant for cost attribution.
- Third-party platforms: Amazon Bedrock, Google Cloud Vertex AI (and Microsoft Foundry) — different model IDs,
  cloud-native auth (IAM / service accounts, not Anthropic API keys), regional availability, and new features may
  arrive later than on the first-party API.
- Models: Opus (most capable, highest cost/latency — complex reasoning, hard coding/agentic tasks), Sonnet (best
  balance — most production workloads, coding), Haiku (fastest, cheapest — high-volume classification, routing,
  sub-agent workers, real-time). Choose the cheapest model that passes your eval at required quality. Pin dated
  snapshot model IDs in production (aliases move to new snapshots); re-run evals before upgrading — new releases
  can change behavior (formatting, verbosity, instruction following, deprecated params). Track deprecation /
  retirement dates.
- LLM fundamentals: text → tokens (≈ 3–4 chars/English token; code and non-English differ); context window = input
  + output budget; next-token prediction; sampling (temperature 0–1, default 1; lower = more focused, but even 0 is
  not fully deterministic); non-determinism → design tests with tolerances/evals, not exact string asserts.
  Zero-shot vs one-shot vs few/multi-shot (3–5 diverse, relevant examples in `<example>` tags).

Prompt & context engineering
- Be clear, direct, specific; give context/purpose; role in system prompt; task-specific instructions & variable
  data in user turn; XML tags to separate instructions from data (`<document>`, `<user_input>`); put long documents
  at the TOP and the query at the end; ask for quotes before analysis; chain-of-thought for complex reasoning;
  prompt chaining for multi-step tasks; output constraints/format via examples or schemas. Iterate against an eval
  set, change one variable at a time, version prompts (store in VCS with IDs, log prompt version per request).
- Context engineering: context window is a finite budget; "context rot"/drift in long sessions; prune/trim
  verbose tool outputs to relevant fields; compaction (summarize and restart with the summary); context editing
  (clear old tool results); memory tool / external notes files for persistent state; subagents give isolated
  context and return condensed results; just-in-time retrieval instead of preloading everything.
- Skepticism toward confident output: models can hallucinate fluently; verify facts against sources, require
  citations/quotes, allow "I don't know", validate numbers with code.

Agents & workflows
- "Building effective agents": start with the simplest solution; workflows (predefined code paths: prompt
  chaining, routing, parallelization [sectioning/voting], orchestrator-workers, evaluator-optimizer) for
  predictable, well-defined tasks; agents (LLM dynamically directs its own tool use in a loop) for open-ended
  problems where steps can't be predicted — at higher cost/latency and compounding-error risk; add guardrails,
  stopping conditions (max turns), and human checkpoints for irreversible actions.
- Agent loop: call model → if stop_reason == tool_use, run tools, append assistant message + tool_results, repeat;
  stop on end_turn (max-iteration cap as safety net). Supervisor/manager (orchestrator) delegates to specialized
  subagents, each with own focused prompt, tools, and isolated context; subagents return condensed results.
- Claude Agent SDK (Python `claude-agent-sdk`, TS `@anthropic-ai/claude-agent-sdk`): same harness as Claude Code;
  `query()` / ClaudeSDKClient; options: system_prompt, allowed_tools / disallowed_tools, permission_mode,
  `can_use_tool` callback for programmatic approvals, mcp_servers (incl. in-process SDK MCP servers via
  `@tool` + `create_sdk_mcp_server`), hooks (PreToolUse, PostToolUse, etc.), `agents` (subagent definitions),
  max_turns, `setting_sources` (filesystem settings/CLAUDE.md not loaded unless specified), session resume.
  Built-in tools: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, Task (subagents) etc. Context
  compaction is automatic. Deployment: self-hosted (your container/sandbox per session) vs Anthropic-hosted
  (managed) — tradeoffs: control, data residency, ops burden.
- Hooks provide DETERMINISTIC control (vs prompts which are probabilistic): PreToolUse can block (deny) a tool call
  (in Claude Code a command hook exiting with code 2 blocks the call and feeds stderr to Claude), PostToolUse for
  logging/formatting/validation, UserPromptSubmit, Stop, SubagentStop, SessionStart, PreCompact, Notification.
- Frameworks: LangGraph (graph/state machine with nodes, edges, persisted state via checkpointers, human-in-the-
  loop interrupts), Strands Agents (AWS open-source, model-driven agent loop, tools as decorated functions),
  PydanticAI (type-safe agents, validated structured outputs via Pydantic models, dependency injection). Choose
  based on control needs; a plain loop is often enough.
- Memory: short-term (conversation/context), long-term (files, memory tool, DB) scoped per user/tenant to avoid
  leakage.

Claude Code
- CLAUDE.md hierarchy: enterprise/managed policy → project `./CLAUDE.md` (or `./.claude/CLAUDE.md`, committed,
  shared) → user `~/.claude/CLAUDE.md` (personal, all projects) → `CLAUDE.local.md` (personal per-project,
  gitignored; deprecated in favor of imports); subdirectory CLAUDE.md files load when working in those dirs.
  `@path/to/file` imports. `/init` bootstraps a CLAUDE.md by analyzing the repo. `/memory` edits memory files;
  starting a message with `#` quickly adds a memory. `.claude/rules/*.md` for modular, optionally path-scoped rules.
- settings.json: user `~/.claude/settings.json`, project `.claude/settings.json` (committed), local
  `.claude/settings.local.json` (personal, gitignored), enterprise managed settings (highest precedence, cannot be
  overridden). Precedence: managed > CLI args > local project > shared project > user. `permissions` with
  `allow` / `ask` / `deny` rules e.g. `Bash(npm run test:*)`, `Read(./.env)` in deny; deny wins. Also `env`,
  `hooks`, `model`, `apiKeyHelper`, `enabledPlugins`.
- Permission modes: default (ask), `acceptEdits`, `plan` (read-only planning), `bypassPermissions`
  (`--dangerously-skip-permissions`, only in isolated sandboxes/containers), auto mode (classifier-gated autonomy).
  Shift+Tab cycles modes.
- Custom slash commands: `.claude/commands/<name>.md` (project) or `~/.claude/commands/` (user); `$ARGUMENTS`,
  `$1`; frontmatter `allowed-tools`, `description`, `model`. Built-ins: /clear, /compact, /context, /cost, /model,
  /resume, /agents, /mcp, /hooks, /permissions, /init, /memory, /plugin, /review.
- Skills: folder with `SKILL.md` (YAML frontmatter `name`, `description`) + optional scripts/resources, in
  `.claude/skills/` or `~/.claude/skills/` or via plugins; progressive disclosure — only name/description loaded
  until relevant, then full instructions; model-invoked automatically based on description (commands are
  user-invoked). Skills also usable via API (code execution) and claude.ai.
- Subagents: `.claude/agents/<name>.md` with frontmatter name, description, tools, model; own context window.
- Headless: `claude -p "prompt"` with `--output-format text|json|stream-json`, `--allowedTools`, `--max-turns`,
  `--permission-mode`; used in CI/CD (e.g. GitHub Actions). Sessions: `claude --continue` / `-c`, `--resume` / `-r`.
- Plugins: bundle commands, agents, skills, hooks, MCP servers; installed from marketplaces via `/plugin`;
  enable/disable per project in settings; pin versions/sources for reproducibility.
- MCP in Claude Code: `claude mcp add`; scopes local / project (`.mcp.json`, committed — use `${ENV_VAR}`
  expansion for secrets) / user.

MCP
- Client–server protocol (JSON-RPC 2.0). Server primitives: tools (model-controlled actions), resources
  (application-controlled read-only data identified by URI), prompts (user-controlled templates, e.g. slash
  commands). Client features: sampling, roots, elicitation. Transports: stdio (local subprocess; NEVER write logs to
  stdout — it corrupts the protocol; log to stderr) and Streamable HTTP (remote, multi-client; supersedes HTTP+SSE);
  remote servers use OAuth 2.1 authorization. Lifecycle: initialize → capability negotiation. Debug with MCP
  Inspector. Official SDKs (Python FastMCP decorators, TypeScript). Build an MCP server when a capability should be
  reusable across many Claude apps/clients; an in-app custom tool when single-app; a Skill for packaged procedural
  know-how/instructions/scripts; built-in tools when they already cover the need (file ops, bash, web search).
- Tool design: clear names & detailed descriptions (what, when, when NOT, params, return format) are the main lever
  for correct tool selection; few focused tools > many overlapping ones; namespacing; return concise high-signal
  results (pagination/truncation); actionable error messages; idempotency for retried writes; human approval for
  destructive/irreversible operations; least-privilege credentials per tool.

Security & safety
- Prompt injection (direct and indirect via documents/web pages/tool results/emails): treat all external content
  as untrusted DATA; delimit it (XML tags); never grant it instruction authority; least-privilege tools; human
  approval / hooks for sensitive actions; output filtering; layered defenses (no single control suffices); a
  "please ignore injections" instruction alone is not a control.
- Jailbreak defense: harmlessness screens (cheap model classifier pre-screen), input validation, system-prompt
  ethics/policy, monitoring/rate limiting abusers.
- Data leakage/PII: data minimization, redact/tokenize PII before sending when not needed, don't log raw prompts
  with PII, tenant isolation for memory/caches/retrieval, authZ checks enforced in code on tool calls using the
  authenticated session identity (never trust model-supplied user IDs).
- Secrets: never in prompts, CLAUDE.md, source code, or client-side code; use env vars / secret managers;
  separate keys per environment/workspace; rotate & revoke leaked keys (GitHub secret scanning can auto-revoke
  Anthropic keys); route browser apps through a backend proxy; least-privilege; monitor usage per key; Workspaces &
  spend limits in Claude Console; cloud IAM for Bedrock/Vertex.
- Hooks for safety: PreToolUse deny `rm -rf`, force-push, prod DB writes, reading `.env`; permission deny rules.

Eval, testing, debugging
- Define measurable success criteria first; build eval sets incl. edge cases from real traffic; grading: code-based
  (exact match, schema, regex) > LLM-as-judge with clear rubric (validate against human labels) > human review;
  run evals on every prompt/model change (regression); monitor production (sampling, dashboards).
- Debugging: read traces/logs (request-id, raw request/response, stop_reason, usage, tool calls/results) to
  isolate whether the failure is in the integration layer (bad request construction, dropped history, wrong
  tool_result mapping, truncated max_tokens, swallowed errors, timeouts mapped to empty results) vs model output
  (wrong reasoning, ignoring instructions). Reproduce with the same inputs; hold the prompt constant and vary one
  factor; classify errors as transient (retry) vs permanent (fix request) vs semantic (prompt/model).

## Question style rules (MUST follow)
- Match the official sample style (example):
  "A developer must process 10,000 documents overnight to produce a non-urgent analytics report. Cost is the primary
  concern, and results are not needed until the following morning. Which approach best fits the requirement?"
  A. Send every request synchronously through the Messages API in parallel…  B. Use the Message Batches API, which
  processes large asynchronous workloads within a 24-hour window at reduced cost.  C. Lower max_tokens…  D. Switch
  to the smallest available model regardless of output quality.
- Scenario-based stems (2–5 sentences) with concrete details (volumes, latency/cost constraints, file names,
  config/code snippets, error messages, HTTP codes). Ask "Which approach best…", "What should the developer do
  FIRST?", "What is the MOST likely cause…", "Which TWO actions…".
- Plausible distractors drawn from common misconceptions (raise temperature, bigger model fixes everything, polite
  prompt line as security control, retry 400 errors, put secret in CLAUDE.md, trust model-supplied IDs, cache the
  dynamic part, sync calls for batch work, etc.).
- Item types per paper: 43–45 multiple-choice (`type:"single"`, exactly 4 options, 1 correct) and 8–10
  multiple-response (`type:"multiple"`, 5 options with exactly 2 correct and stem ending "(Select TWO.)", or at most
  2 items with 6 options and 3 correct ending "(Select THREE.)").
- Spread correct option positions evenly across A–D(E) — no position should hold > 35% of answers. The correct
  option must not be systematically the longest; keep options similar in length. No "All/None of the above".
- Difficulty mix: ~20% easy, ~55% medium, ~25% hard. Hard = several options partially valid, pick BEST tradeoff.
- Explanation (2–4 sentences): why correct is right AND why main distractors are wrong.
- Original content only (do not copy the 3 official sample questions verbatim). No duplicate concepts within a
  paper; vary industries, numbers, and angles to stay distinct from other papers.
- Mix domains in question order (do NOT group by domain) — like the real exam.

## Data format (MUST match exactly)
File `papers/paperNN.js` (NN = 01..10), classic script (no modules):

```js
window.EXAM_PAPERS = window.EXAM_PAPERS || {};
window.EXAM_PAPERS[1] = {
  id: 1,
  title: "Practice Exam 1",
  questions: [
    { id: 1, domain: "D2", difficulty: "medium", type: "single",
      question: "Stem text...",
      options: ["A text", "B text", "C text", "D text"],
      answer: [1],                    // 0-based indices of correct options (array, even for single)
      explanation: "Why..." },
    { id: 2, domain: "D7", difficulty: "hard", type: "multiple",
      question: "Stem ... Which TWO actions should the developer take? (Select TWO.)",
      options: ["A", "B", "C", "D", "E"],
      answer: [0, 3],
      explanation: "..." }
    // ... 53 questions, ids 1..53
  ]
};
```
Inline code in any text may use backticks: `like_this` (UI renders as <code>). Newlines `\n` in stems are preserved
(use for small code/config snippets). Must be valid JS: prefer double-quoted strings with escaped inner quotes.
