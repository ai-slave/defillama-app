# Agent Commands and Conventions

This file defines the commands and working conventions that all AI agents must follow in this repository.

## Package Manager

- Use `bun` for all package management and project commands, and `bunx` to run a package binary.
- Do not use `npm`, `npx`, `yarn`, or `pnpm`.

## Approved Commands

- Format code with `bun run format`
- Run tests with `bun run test`
- Run lint checks with `bun run lint`
- Run TypeScript checks with `bun run typecheck`

## Forbidden Commands

- Do not run `bun run build` or any other build command. Builds are expected to fail because of API rate limits.
- Do not use `bun test`. Use `bun run test` so tests run through the repo's Vitest script.

## Verification

During implementation, run only the smallest targeted test or check that proves the requested change. Do not run repo-wide format, lint, typecheck, or test commands after every intermediate edit.

Subagents and review agents must not run repo-wide verification commands. They should report relevant targeted verification to the coordinating agent.

For multi-agent work, only the coordinating agent may run broad verification, and only after all implementation and review agents have finished and their changes have been integrated. Do not run write-formatting commands while another agent is still working.

Run the full verification sequence only when:

- The user explicitly requests CI or full verification.
- Preparing a user-requested commit or pull request.
- The coordinating agent determines the change is broad enough that targeted checks cannot reasonably validate it.

The full verification sequence is:

1. `bun run format`
2. `bun run lint`
3. `bun run typecheck`
4. `bun run test:typecheck`

`bun run format` must finish before the other checks because it writes files. After formatting completes, `bun run lint`, `bun run typecheck`, and `bun run test:typecheck` may be run in parallel.

Do not run the full verification sequence for documentation-only or instruction-only edits unless the user explicitly asks.

If the user asks to run specific commands, run only those commands unless code changes are needed to complete the request.

Before finalizing without full verification, state which targeted checks ran and which broader checks were skipped.

## Metric Semantics

Before changing metric routes, chart queries, metadata flags, public API validation, or adapter data types, read `docs/metrics.md`.

`public/pages.json` contains product-facing page definitions. `docs/metrics.md` documents implementation semantics and overloaded terminology that can affect code paths.

## Local User Instructions

If `.codex/local-instructions.md` exists, read and follow it before making code changes. It contains local user preferences and skill routing, and is intentionally gitignored.
