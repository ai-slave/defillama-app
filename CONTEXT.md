# DefiLlama App Context

## Dataset Snapshots

Dataset snapshots are generated under `.cache/dataset-snapshots` for server-side routes that need large upstream datasets at runtime. Each domain, such as `yields`, `liquidations`, or `markets`, owns immutable version directories and one atomic `current.json` pointer.

Each version manifest records its domain, snapshot ID, storage format, schema version, and creation time. Preparation publishes domains independently through the same store used by runtime refresh. A failed candidate leaves that domain's previous pointer untouched. Runtime refresh may call the registered network builder when a snapshot is stale, but required artifact reads never fall back directly to live APIs.

Snapshot artifacts are read through a server-only handle for one immutable generation, then passed into pure transforms. This differs from metadata artifacts because dataset domains can be large and route-specific, so the standalone server traces the generated versions without importing the JSON into browser modules.

## Metadata Artifacts

Metadata artifacts are the generated `.cache/app-metadata/*.json` files loaded by `src/utils/metadata` at server boot. Their filenames, CI stubs, artifact parsers, initial runtime cache shape, and refresh application live behind the metadata artifact registry so the artifact contract stays in one place.

The metadata manifest is `.cache/app-metadata/manifest.json`. It records whether the static metadata artifacts are a `ready` pull or a local/CI `stub` set, and replaces the older `.cache/lastPull.json` freshness marker.

The metadata pull command is a thin command Adapter around metadata artifact publishing. Site navigation publishing owns page ordering, Tasty metrics, and trending output separately. Upstream source fetching and local/CI stub policy live in separate Modules so each reason to change stays local.

Metadata artifacts are the boot snapshot, while runtime refresh keeps each live process current in memory. Runtime refresh accepts parsed backend JSON according to the TypeScript artifact contract before replacing the current cache; failed refreshes keep stale data. Local/CI metadata stubs intentionally demote upstream failures into empty artifacts so contributors can start the dev server without private API access. Dataset snapshots keep their last good durable version; a missing initial version plus refresh failure remains a hard error.

## Runtime Domain Modules

Runtime domain modules acquire one immutable version handle and pass typed data into pure transforms. Network acquisition belongs only in snapshot builders. Pages and API routes call typed domain modules rather than importing filesystem readers.

## Command Layer

The command layer is the set of local and deploy commands that prepare generated artifacts, run Next.js builds, sync deploy artifacts, send build notifications, and run post-start hooks. Shell files in `scripts/` are compatibility wrappers; command policy lives in TypeScript Modules under `scripts/command`.

Preparation is the command layer path that refreshes metadata artifacts, publishes the dataset snapshot, and writes `public/robots.txt` before Next.js starts. Deploy build orchestration adds the Next.js production build, `.next/static` artifact sync, build-log capture, and notification adapters. The post-start hook runs after the server process starts and currently owns the Cloudflare cache purge adapter.
