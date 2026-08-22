# ADR 0006: Defer A LlamaAI Session Event Feed

## Status

Deferred

## Context

LlamaAI currently sends commands through HTTP and streams one execution through
SSE. Queue snapshots, session restore, active-execution discovery, replay, and
held queue attachment complete the browser recovery contract.

Queue handoff and session switching exposed ordering races when several browser
paths tried to infer the same session state from independently timed responses.
The current stabilization gives those paths one execution owner, explicit
execution identity, server replay cursors, revisioned queue snapshots, and
idempotent mutation identities.

A session-wide SSE or WebSocket has been proposed as a simpler transport. A new
connection alone would not establish ordering or authority. Running it beside
the execution stream and existing REST recovery paths would add another event
owner and make cross-transport ordering ambiguous.

The rejected durable mobile outbox investigation addressed a materially larger
problem: offline persistence, crash recovery, exactly-once admission, attachment
durability, process loss, multi-replica authority, deletion, and account
erasure. That design is not a suitable implementation base for connected web
chat.

## Decision

Keep the current HTTP command and execution-SSE transport while the queue and
execution lifecycle is stabilized. Do not add a parallel session SSE or
WebSocket in this work.

The only preferred long-term candidate is:

- idempotent HTTP commands for prompt, queue, edit, Stop, and session mutations
- one ordered, resumable SSE feed for the selected session
- one restore snapshot carrying the event cursor from which the feed continues

SSE is sufficient because client commands already have request/response
outcomes. WebSocket is not justified without a bidirectional low-latency product
requirement that HTTP commands cannot satisfy.

The session feed is a replacement architecture, not an additional notification
channel. It may proceed only when it deletes the execution probes, held queue
attachment, and competing restore/reconnect paths that it supersedes.

## Adoption criteria

A proposal must define and prove all of the following before production work:

1. Every event carries a session sequence and the identities needed to apply it
   to one queue item, execution, or message.
2. Reconnect resumes from a server-owned cursor without duplicating or skipping
   events.
3. Restore returns an authoritative snapshot and the cursor immediately after
   that snapshot.
4. Command acceptance is idempotent before any execution or durable side effect
   starts.
5. Multi-replica delivery uses a shared event source or replay store rather than
   process-local subscription state.
6. Authentication, session ownership, multi-tab subscribers, event retention,
   and expired cursors have explicit outcomes.
7. The frontend has one session subscriber and one reducer boundary.
8. The change removes more lifecycle policy than it introduces. The proposal
   names the probes, loops, controllers, and compatibility paths it deletes.
9. Rolling deployment does not require old and new transports to act as
   simultaneous authorities.

## Consequences

- Current queue and execution fixes remain useful. Mutation identity, execution
  identity, queue revisions, and replay cursors are prerequisites for either
  transport.
- The frontend execution owner remains a containment boundary around the
  current APIs. It is not treated as the ideal permanent transport architecture.
- A session feed requires a separately reviewed backend protocol and rollout.
  It cannot enter an unrelated queue, draft, rendering, or mobile feature PR.
- Offline mobile delivery, a durable device outbox, cross-session live caching,
  and WebSocket command transport remain separate product decisions.
