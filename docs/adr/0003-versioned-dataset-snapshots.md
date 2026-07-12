# ADR 0003: Versioned dataset snapshots

## Status

Accepted

## Context

Dataset preparation previously replaced one mutable `.cache/datasets` tree and
the runtime reader memoized its parsed files for the process lifetime. That was
fast, but a long-running server could not observe fresh upstream data without a
new deployment. Reintroducing per-route read-through fetches would duplicate
freshness policy, allow related artifacts to come from different generations,
and couple callers to local disk.

## Decision

Store each domain as immutable version directories with an atomic `current.json`
pointer. Publish domains independently through `DatasetSnapshotStore`. Builders
write opaque artifacts through `DatasetSnapshotWriter`; readers access one
generation through `DatasetSnapshotHandle`.

A central coordinator refreshes stale domains, coalesces concurrent work, and
serves the last good handle when an attempted refresh fails. ISR paths use
blocking refresh; public APIs may use background refresh. The on-storage format
is version 2.

## Consequences

- Data can refresh without a commit or deployment.
- Failed upstream calls cannot destroy the last good dataset.
- One response cannot mix artifacts from multiple generations when it retains a
  single handle.
- Parsed and derived memoization invalidates naturally by snapshot identity.
- Local disk remains per-replica. Multi-replica and Workers deployments need a
  shared store implementation and a distributed refresh lease, but domain
  builders and readers do not need to change.
- Old versions require a later, explicit garbage-collection policy that respects
  active readers.
