# LlamaAI Simplification Plan

> **Execution rule:** Work on exactly one phase per branch and pull request. For every phase, first preserve or add behavior coverage, then implement the smallest cohesive change. Run the required verification, automatically review the complete phase diff, and perform a separate adversarial review focused on opposite-edge regressions, auth/subscription gates, concurrency, and UI behavior. Fix every valid finding or record a concrete evidence-based refutation. Only then commit, push, and open a ready-for-review PR. **Stop after opening that PR. Do not begin another phase until the current PR is merged.** Start the next phase from the latest `origin/main`; do not stack phase branches.

This is a handoff document for simplifying `src/containers/LlamaAI` without
removing features, weakening boundary checks, or changing the UI accidentally.
It is deliberately organized as independently reviewable phases. A phase may
end with a documented no-op when investigation shows that the existing
complexity is required.

## Current baseline

PR [#3128](https://github.com/DefiLlama/defillama-app/pull/3128) is the prerequisite
for this plan. It:

- makes price alert edits atomic by sending trigger, metadata, condition, and
  delivery changes in one request;
- keeps the alert editor open until that combined update succeeds;
- gives anonymous LlamaAI alert entry points an explicit sign-in state; and
- replaces brittle copy/constant tests with behavior coverage for alert access,
  requests, failures, and cache updates.

Do not start Phase 1 until PR #3128 is merged. The roadmap itself may evolve as
each phase uncovers better evidence, but later phases must not be pulled into an
earlier PR.

## Non-negotiable behavior

Read `ARCHITECTURE.md` and `MAINTAINING.md` before changing LlamaAI code. Preserve
these system invariants throughout the roadmap:

- Prompt, edit, resume, and replay requests go through `runAgenticRequest`.
- `StreamAccumulator` remains the commit source; reducer state remains the live
  render snapshot.
- Stale SSE events are rejected by the guarded callbacks in
  `streamCallbacks.ts`.
- A stream that closes without `done` enters recovery unless it was aborted.
- Quick, fact-checked, and research modes retain their distinct request,
  entitlement, usage-limit, and modal behavior.
- `/ai/chat?prompt=...` remains confirmation-gated for both authenticated and
  anonymous visitors.
- Project chat requests retain `projectId`; project session mutations keep
  global and project caches coherent.
- Persisted, shared, and live messages normalize into the same domain `Message`
  shape before rendering.
- Chart payload validation stays at the JSON/API boundary. The public chart
  adapter exports and Pro Dashboard integration remain compatible.
- Fact-check citations keep their complete SSE-to-renderer-to-sanitizer path.
- Telegram linking, Slack OAuth/workspace/channel selection, polling, unlinking,
  and alert delivery continue to work.
- Alert schedules continue to allow all 24 hours. Alert edits are atomic.
- Anonymous, trial, free, subscribed, usage-limited, and credit-limited users
  continue to see the correct gate and call to action at every entry point.
- Image upload, paste, preview, removal, retry, and prompt attachment behavior
  remain intact, including file-count and size limits and object URL cleanup.
- Shared chat viewing, sign-in-and-fork, session branching/editing, exports,
  saved charts, dashboards, settings, onboarding, and responsive chrome retain
  their current visible behavior.

## What “simpler” means

The objective is not a smaller line count by itself. Prefer changes that remove
one or more of these costs:

- state that can be derived during render;
- effects that only copy React state to other React state;
- duplicate event paths for the same user action;
- separate mutations that represent one atomic user operation;
- controlled form fields that are read only on submit;
- reset effects that can be replaced by a keyed form boundary;
- repeated auth, subscription, loading, and integration-state decisions;
- render-time transforms repeated for unchanged messages or chart payloads;
- components that mix orchestration, transport, cache updates, DOM effects, and
  presentation;
- helpers or tests that merely restate constants, labels, markup, or types.

Do not replace direct code with a generic hook, context, reducer, state machine,
or adapter unless it removes real duplication or makes an invariant enforceable
in one place. Do not add memoization or virtualization without a measured hot
path. Complexity that coordinates a stream, router, browser API, timer, poller,
focus target, scroll position, object URL, or external cache is not presumed to
be accidental.

## Effect and form decision rules

Every React phase must classify each touched effect before changing it:

1. **External synchronization — keep an effect.** Examples include SSE and
   abort-controller lifecycles, router/history synchronization, document/window
   listeners, focus and selection, scroll anchoring, `ResizeObserver`, visual
   viewport changes, timers, integration polling, notifications, cookies,
   storage, and object URL cleanup.
2. **User action — move to the event.** If work happens only because the user
   submitted, selected, opened, closed, deleted, or retried something, perform it
   in that handler or mutation callback.
3. **Pure derivation — calculate during render.** Do not store filtered lists,
   access states, labels, or booleans that can be derived from props/query state.
4. **Expensive pure derivation — memoize only with evidence.** First show that
   the calculation or referential churn matters in the real render path.
5. **Reset on identity change — use a key when it represents a new form.** Put
   the key on the smallest state-owning form boundary, not the whole modal or
   page.

Use native `<form>` submission, `FormData`, `defaultValue`, and uncontrolled
inputs when a field is only needed at submit time. Keep a field controlled when
its value immediately drives validation, conditional UI, entity suggestions,
textarea sizing, keyboard/IME behavior, file attachments, a preview, or another
request. A keyed remount must not discard an in-progress draft unexpectedly.

## Review and verification protocol for every phase

1. Rebase the new phase branch on the latest `origin/main` after the preceding
   PR is merged.
2. Write down the clean state model, intentional behavior, invariants, and
   likely opposite-edge regression in the PR notes before editing.
3. Add or strengthen behavior tests at stable seams. Avoid snapshots and tests
   tied to exact copy, class names, icon choices, constant tables, or component
   structure.
4. If React code is touched, run React Doctor against the entire repository,
   not just changed files. Treat its output as leads to investigate, not commands
   to apply mechanically.
5. Implement only the named phase. Record before/after counts for state/effects
   or render work when those counts are part of the phase's claim.
6. Run focused tests while iterating. When source code is complete, run the
   repository-required sequence: `bun run format`, then `bun run lint`,
   `bun run typecheck`, and `bun run test:typecheck`. Run relevant behavior tests
   with `bun run test` as needed; never run a build.
7. Automatically review the full branch diff against its base. Check for
   accidental public API changes, unrelated formatter churn, dead code, added
   abstractions, and tests that pass without exercising the changed behavior.
8. Perform a separate adversarial review. At minimum, try anonymous/auth-loading,
   free/trial/paid, request success/failure/abort, slow and out-of-order
   responses, modal close/reopen, route changes, restored/shared/live sessions,
   desktop/mobile, keyboard-only use, and the opposite edge of the bug being
   addressed.
9. Triage every finding. Fix valid findings and rerun affected checks. Refute
   invalid findings with file/line and test or contract evidence in the PR notes.
   Do not silently dismiss a finding.
10. Inspect the final staged and unstaged changes, commit with a phase-specific
    message, push, and open a non-draft PR. Stop until it is merged.

## Feature and integration inventory

Use this as the regression surface for planning tests and manual checks.

| Area                      | Primary ownership                                                                            | Important external integrations                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Landing and entry points  | `src/pages/ai/index.tsx`, `ChatLanding`, nav/search, floating button, entity-question strips | Auth return paths, pending prompt/page context, suggested-prompt flag                |
| Chat routes and chrome    | `/ai/chat`, session and shared routes, `LlamaAIShell`, route/navigation contexts, cookies    | Next router/history, full-screen/sidebar cookies, responsive shell                   |
| Prompt and modes          | `PromptInput`, input components, `AgenticChat`                                               | Quick/fact-checked/research mode, project scope, deep-link confirmation              |
| Images and pasted files   | `useImageUpload`, `PastedContentModal`, `ImagePreviewModal`                                  | Upload endpoints, browser files/clipboard, object URLs, size/count limits            |
| Request and streaming     | `runAgenticRequest`, `fetchAgenticResponse`, `streamCallbacks`, `streamState`                | SSE, abort, detach, heartbeat, recovery, resume, replay                              |
| Messages and citations    | `messageMappers`, `renderModel`, `ConversationView`, `MessageBubble`, markdown components    | Restored/shared/live shapes, fact-check citations, selection/edit branches           |
| Charts and exports        | chart payload/adapters/renderer, CSV/Markdown/PDF artifacts                                  | ECharts, download/browser APIs, saved charts, style persistence                      |
| Dashboards                | `DashboardPanel`, Add-to-Dashboard and Pro Dashboard consumers                               | Chart promotion, generated/edited dashboards, saved LlamaAI chart IDs                |
| Alerts                    | `AlertArtifact`, `CreateAlertModal`, `AlertsModal`, alert API/schedule/form helpers          | Streamed/restored alerts, token-page entry, push/Telegram/Slack delivery             |
| Telegram and Slack        | integration hooks, API modules, settings rows                                                | Polling, deep links, OAuth return, workspaces, channels, unlinking                   |
| Projects                  | project pages/components/API/hooks, session mutations                                        | Files, pasted text, instructions, GitHub installation/repositories, tier limits      |
| Settings and onboarding   | `SettingsModal`, settings hooks, walkthrough/tips/banners                                    | Persisted user settings, local storage, route intents, subscription state            |
| Auth, limits, and credits | auth context consumers, limit modals, trial card, top-up UI                                  | Sign-in, trials/subscriptions, free/research/fact-check usage, external-data balance |
| Sharing and feedback      | sidebar session actions, `ShareModal`, `FeedbackForm`                                        | Public/private links, shared-session fork, clipboard, ratings                        |

## Phase 1 — Baseline behavior and performance evidence

Goal: make later deletion safe and keep optimization work evidence-driven.

- Re-run React Doctor over the entire repository and classify only the findings
  that apply to LlamaAI or its consumers. Record accepted and refuted findings.
- Create a concise before-state inventory for the largest state owners:
  `index.tsx`, `SettingsModal`, `AlertsModal`, `ConversationView`,
  `MessageBubble`, `PromptInput`, `AgenticSidebar`, `useImageUpload`, and
  `useSessionMutations`.
- Capture render evidence for a long restored conversation, an active stream,
  typing with attachments, opening settings/alerts, and expanding a chart. Note
  actual repeated expensive work; do not infer it from component size alone.
- Add missing characterization tests only at stable seams. Prioritize mode and
  project request bodies, prompt/edit error parity, stale callbacks, recovery
  decisions, deep-link confirmation, image attachment submission, auth-loading
  gates, and integration polling transitions.
- Produce a small manual smoke checklist covering the feature inventory above.
  Reuse it in every later phase.

Exit criteria: later phases have a reliable regression harness and named
performance targets. This phase should not refactor production behavior.

## Phase 2 — Auth, subscription, usage, and credit access states

Goal: make every gate explicit and consistent without creating a universal
paywall component.

- Inventory each LlamaAI entry point and derive a small discriminated access
  state where the same decision is currently repeated: auth loading,
  anonymous, authenticated-free/trial, paid, feature-limited, and ready.
- Ensure queries and mutations are disabled while auth is unresolved or the
  user is ineligible, and ensure the visible UI matches that disabled state.
- Align toolbar, sidebar, landing, floating-button, token-alert, settings,
  project, saved-chart, fact-check, research, PDF export, and integration entry
  points. Preserve intentional differences in copy and upgrade destination.
- Keep usage exhaustion distinct from entitlement failure. In particular, do
  not fold `FACT_CHECKED_REQUIRES_SUBSCRIPTION`, research limits, general free
  limits, project tier caps, alert caps, or external-data credit balance into a
  single boolean.
- Test auth loading separately from anonymous state and test both eligible and
  ineligible authenticated users. Include return URLs and modal close/reopen.

Exit criteria: no entry point falls through to a usable-looking UI that can only
fail with “Not authenticated,” and feature-specific gates remain distinct.

## Phase 3 — Native forms and modal reset boundaries

Goal: remove submit-only React state and reset effects while preserving dynamic
form behavior.

- Start with `SettingsModal`, `CreateAlertModal`, `AlertsModal`, project create/
  rename, add-text, project instructions, and GitHub source forms.
- For submit-only fields, use a real `<form>`, named controls, `FormData`, and
  `defaultValue`. Let the browser provide Enter-to-submit and native semantics.
- Key the smallest form body by the edited entity ID plus an open/reset revision
  when a genuinely fresh draft is required. Do not key the overlay, integration
  hooks, queries, or mutation state unnecessarily.
- Keep controlled state for conditional delivery fields, Slack workspace/channel
  dependencies, live validation, upload progress, and values that immediately
  alter the UI.
- Do not convert `PromptInput` wholesale. Its live text drives keyboard behavior,
  trigger detection, entity/capability UI, textarea sizing, paste handling, and
  attachments. Convert individual subcontrols only when behavior tests prove
  they are submit-only.
- Split modal sections only when they own a coherent form or integration state.
  Avoid presentational extraction that increases prop plumbing.

Exit criteria: fewer state variables and reset effects, equivalent drafts on
open/edit/reopen, and improved keyboard/form semantics with no visual change.

## Phase 4 — Agentic request orchestration and error-path deduplication

Goal: shrink `index.tsx` while strengthening the single request lifecycle.

- Identify prompt, edit, resume, replay, shared-fork, and project-start paths in
  `AgenticChat`; map their shared and intentionally different steps.
- Consolidate duplicated error-to-UI handling for free limits, usage limits,
  fact-check subscription requirements, temporary connectivity, abort, and
  generic failures. Preserve feature-specific modal state and copy.
- Move cohesive workflows behind narrowly named controllers/hooks only when the
  extracted unit owns an external lifecycle or removes duplication. Keep plain
  render derivations as functions rather than hooks.
- Keep request IDs, abort controllers, event counters, accumulator ownership,
  callback guards, recovery cycles, and settle behavior in one auditable path.
- Remove state that mirrors reducer/request/query state. Move action-caused work
  out of effects and into the initiating callback.
- Test prompt/edit parity, rapid replacement, stale events, abort during each
  transport mode, missing `done`, resume cursor behavior, replay suppression,
  and project-scoped requests.

Exit criteria: `AgenticChat` remains the orchestration shell but has fewer
duplicate branches and mirrored states; all request modes retain one lifecycle.

## Phase 5 — Route, session, sidebar, and chrome synchronization

Goal: make navigation ownership clear and remove state-copying effects without
breaking browser behavior.

- Audit session restore/pagination, new-chat reset, shared-session fork, project
  landing reset, route refinement, title updates, and sidebar selection.
- Assign each route side effect to one owner among page route components,
  navigation context, `LlamaAIShell`, and `AgenticChat`. Remove duplicate history
  or route reactions only after proving ownership.
- Treat URL/history, cookies, local storage, media queries, outside-click
  listeners, and responsive sidebar behavior as external synchronization.
- Simplify `useSessionMutations` and session cache helpers around explicit cache
  operations. Preserve global/project lists, pagination, rename/move/delete,
  public/private sharing, and the currently active session.
- Test direct loads, back/forward, session-to-session navigation, new chat,
  mobile sidebar close, project home, shared fork before/after sign-in, and
  failed restore.

Exit criteria: one owner per navigation side effect, no route loops or stale
session flashes, and cache transitions remain coherent.

## Phase 6 — Prompt, attachment, and draft lifecycle

Goal: simplify prompt composition without losing any browser- or upload-driven
state.

- Model the draft as the minimum set of user-owned values: text, attachments,
  pasted-content decisions, selected mode, and any active suggestion/capability
  interaction. Derive labels, limits, and readiness.
- Keep upload side effects in `useImageUpload`, but separate pure validation from
  upload/object-URL lifecycle where that makes tests direct.
- Ensure submit captures one coherent text-and-attachments snapshot and cannot
  send files that are removed, still uploading, rejected, or from a previous
  keyed draft.
- Audit duplicate keyboard listeners, trigger detection, entity/capability
  overlays, IME composition, mobile behavior, textarea sizing, drag/drop, paste,
  preview, retry, and URL revocation.
- Avoid a generic “draft framework.” Prefer browser primitives and direct event
  handlers where the behavior is local.
- Test mixed file types, partial upload failure, removal during upload, paste
  cancellation/acceptance, reset after successful submit, retained draft after
  failure, mode changes, and project prompt submission.

Exit criteria: fewer mirrored draft states and effect chains, with attachment
and keyboard behavior unchanged.

## Phase 7 — Message rendering, citations, and conversation performance

Goal: prevent repeated work for unchanged messages and separate interaction
effects from message interpretation.

- Keep persisted/shared/live normalization outside render components. Compute a
  message render model once per changed domain message rather than repeating
  parsing or registry construction down the tree.
- Review `ConversationView`, `MessageBubble`, `ChatMarkdownRenderer`, citation
  components, response controls, selection popup, sections TOC, and status
  panels for duplicated transforms and prop chains.
- Preserve markdown sanitization, fact-check pill allowlisting, citation detail
  behavior, artifact ordering, report markers, edit/branch anchors, keyboard
  shortcuts, scroll anchoring, hash highlights, and streaming draft updates.
- Memoize only stable message subtrees shown by Phase 1 profiling. Do not memoize
  trivial JSX or introduce deep comparison. Consider virtualization only if a
  measured long-chat bottleneck remains and a separate behavior plan covers
  dynamic heights, anchors, selection, charts, and streaming.
- Keep DOM measurement/listener effects that synchronize scrolling, selection,
  resizing, and focus. Remove only effects that mirror renderable state.
- Test restored/shared/live equivalence, citations, mixed artifacts, branch edit,
  copied/exported content, hash navigation, keyboard selection, active stream,
  and long conversations.

Exit criteria: measured render work improves, unchanged messages stay stable,
and message/artifact output is byte-for-byte or visibly equivalent where
required.

## Phase 8 — Alerts and delivery integration consolidation

Goal: remove duplicated alert form and delivery logic after the atomic-update
baseline is merged.

- Compare `AlertArtifact`, `CreateAlertModal`, and `AlertsModal` ownership of
  validation, request bodies, condition/config mapping, schedules, limits,
  Telegram state, Slack workspaces/channels, and delivery selection.
- Share pure alert domain/form transforms that are genuinely identical. Keep
  streamed/restored artifact presentation separate from saved-alert management.
- Use one mutation per user operation and one cache transition per successful
  mutation. Keep dialogs open on failure and surface the error beside the action
  that failed.
- Reuse derived Telegram/Slack link states rather than starting duplicate polls.
  Do not force the two integrations through one generic hook if OAuth workspaces
  and Telegram token confirmation make their state machines materially different.
- Preserve push permission behavior, test delivery, alert caps, schedules and
  timezones, execution history, enable/disable, delete, and token-page creation.
- Test create/update/delete/toggle/test failures, delivery changes, linked/
  pending/unlinked integrations, empty Slack channels, auth transitions, cache
  rollback/refresh, and all 24 schedule hours.

Exit criteria: one domain mapping for each alert operation, no partial updates,
and no regression across the three alert surfaces.

## Phase 9 — Settings, integrations, onboarding, and transient UI effects

Goal: isolate browser/integration lifecycles from large render components.

- Split `SettingsModal` by cohesive tabs only where a tab owns its own form or
  query lifecycle. Keep shared open/close and save semantics at the modal level.
- Audit settings persistence for local optimistic state versus server state;
  remove effects that copy one into the other when a keyed draft or mutation
  result is sufficient.
- Keep Telegram polling and Slack OAuth return handling explicit. Ensure polling
  starts and stops from derived states and cannot outlive an unmounted/closed
  consumer.
- Review walkthrough, tips, notification permission, viewport, focus trap,
  outside-click, timers, and body overflow effects for cleanup and single
  ownership. These are external effects and should not be removed merely to
  reduce counts.
- Preserve custom instructions, data-source preferences, integration status,
  alert delivery dependencies, onboarding completion, and local dismissal state.
- Test slow settings saves, close during save, failed saves, link/unlink races,
  OAuth return, polling cleanup, viewport changes, reduced motion, keyboard
  navigation, and reopening each tab.

Exit criteria: smaller coherent state owners, no leaked listeners/polls/timers,
and unchanged settings and onboarding UI.

## Phase 10 — Charts, saved artifacts, dashboards, and exports

Goal: simplify only proven duplication in a necessarily complex rendering
pipeline.

- Keep runtime validation in `chartPayloads.ts` and family adaptation behind the
  `chartAdapter.ts` facade. Remove defensive render-time normalization that
  duplicates a trusted domain contract.
- Audit `ChartRenderer`, style editor, capabilities, view-state normalization,
  transforms, render-plan construction, export models, and Pro Dashboard time
  filtering for repeated full-data passes and referential churn.
- Combine large-data transforms only when the result is clearer and benchmarked.
  Preserve chart-family differences rather than hiding them behind condition-heavy
  generic code.
- Keep chart fullscreen/body overflow, resize events, capture, download, style
  persistence, saved-chart promotion, Add-to-Dashboard, and Pro Dashboard
  consumers working.
- Treat generated dashboard operations as atomic user workflows and preserve
  entitlement gates and saved chart/session/message identifiers.
- Test each chart family, malformed boundary payloads, restored charts, style
  save failure, fullscreen/resize, CSV/Markdown/PDF export, save/add to dashboard,
  dashboard iteration, and read-only shared views.

Exit criteria: less repeated transform/render work with stable public adapters
and no chart or dashboard visual regression.

## Phase 11 — Projects, files, GitHub sources, and project limits

Goal: make project state and mutations direct without weakening tier or cache
rules.

- Review project list/detail/files/usage queries for duplicated enablement and
  cache invalidation. Keep query keys centralized.
- Simplify create/rename/delete, instructions, text/file upload, GitHub install/
  repo selection, source attach/remove, and move-session flows around explicit
  mutations and cache outcomes.
- Use native forms and keyed reset boundaries from Phase 3 where applicable.
  Keep upload progress and dependent GitHub selections controlled.
- Preserve free/trial/paid project, file, and byte caps; pending/deleted files;
  project-scoped sessions; instructions; and `projectId` on requests.
- Test cap boundaries, concurrent uploads, partial failure, delete during load,
  GitHub OAuth/install return, repository pagination/selection, moving the active
  session, and project deletion navigation.

Exit criteria: predictable query/mutation ownership and no stale global versus
project session or file state.

## Phase 12 — Final dead-code, test-value, and UI regression sweep

Goal: remove leftovers only after the behavior-preserving phases have landed.

- Use imports, routes, API contracts, and feature inventory evidence to find
  unreachable components, props, state, effects, helpers, styles, and tests.
- Remove tests that only lock exact marketing copy, CSS classes, icons, constant
  mappings, branded type constructors, or implementation structure. Retain tests
  for user-visible decisions, request bodies, state transitions, parsing,
  concurrency, cache behavior, and security/access boundaries.
- Re-run React Doctor on the entire repository and compare with the Phase 1
  baseline. Investigate regressions and refute false positives with evidence.
- Run the full smoke matrix on desktop and mobile, including all auth/tier states
  and external integrations that can be exercised safely.
- Update `ARCHITECTURE.md` and `MAINTAINING.md` to match the final ownership and
  stable test seams. Do not leave aspirational architecture in those documents.

Exit criteria: no known dead paths or low-value tests remain in LlamaAI, the
architecture documents match reality, and measured performance is no worse than
the baseline.

## Handoff template for each phase

Copy this into the phase PR notes and fill it with evidence:

```md
### State model

- Intentional behavior:
- State/effects being removed or re-owned:
- External synchronization that remains:
- Opposite-edge regression:

### Behavior coverage

- Tests added or changed:
- Manual scenarios exercised:
- Performance evidence, if applicable:

### Automated review

- Findings fixed:
- Findings refuted, with evidence:

### Adversarial review

- Auth/tier cases:
- Concurrency/failure cases:
- Route/restore/shared cases:
- Desktop/mobile/keyboard cases:
- Findings fixed or refuted:

### Verification

- `bun run format`:
- `bun run lint`:
- `bun run typecheck`:
- `bun run test:typecheck`:
- Focused `bun run test` commands:

### Remaining risk

- Known untested external dependency or manual-only behavior:
```

The next agent should begin by checking whether the preceding phase PR is
merged. If it is not merged, review or improve that PR only; do not start the
next phase.
