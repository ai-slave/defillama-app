# Containers

Each folder here owns one product surface: its page components, page data and upstream fetchers. To find the owner of a route, open its page in `src/pages/` and follow the container import.

Public route slugs come from `src/pages/` and stay stable. A container name is an implementation boundary, so renaming a folder never renames a route.

## File names

| File                                                     | Holds                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `api.ts`                                                 | Upstream fetchers and URL construction for the domain                                |
| `api.types.ts`                                           | Raw upstream response types                                                          |
| `queries.ts` or `queries.tsx`                            | Page-data builders that page components may also import                              |
| `queries.server.ts` or `.tsx`                            | Page-data builders only data functions call                                          |
| `queries.client.tsx`                                     | Browser query hooks                                                                  |
| `server/api.ts`                                          | Framework-neutral API route definitions that thin files under `src/pages/api/` mount |
| `server/routes.ts`                                       | Sitemap and static path params only, never API handlers                              |
| `server/routeData.ts`                                    | Snapshot-backed data that `server/routes.ts` reads                                   |
| `server/upstream.ts`                                     | Direct upstream fetchers used only on the server                                     |
| `server/dataset.builder.server.ts`                       | Network acquisition that writes an unpublished snapshot candidate                    |
| `server/dataset.index.ts`, `server/dataset.transform.ts` | Pure transforms that build snapshot artifacts                                        |
| `server/dataset.server.ts`                               | Typed read access to the published snapshot for pages and API handlers               |
| `server/charts.ts`                                       | Domain chart assembly that is more than an HTTP handler                              |

Dataset snapshot modules are imported only from server code: page data functions, API handlers and other server modules. See `docs/server-data.md`; `src/server/datasetSnapshots/__tests__/importBoundary.test.ts` enforces the rule.

## Confusable owners

| You are changing                                                                  | Owner                                                                      |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| One protocol: `/protocol/[protocol]`, its subroutes, `/chart/protocol/[protocol]` | `ProtocolOverview/`                                                        |
| One CEX: `/cex/[cex]` and its subroutes                                           | `ProtocolOverview/` layout, with sections from `Cexs/`                     |
| The shared protocol ranking table, `/protocols`, or `getProtocolsByChain`         | `ProtocolRankings/`                                                        |
| `/recent`, `/airdrops`, token metric lists (`/mcaps`, `/fdv`…), extra-TVL lists   | `ProtocolLists/`                                                           |
| Categories and tags: `/categories`, `/protocols/[category]`                       | `ProtocolTaxonomy/`                                                        |
| Fees, revenue, volume, open interest, P/F, P/S by protocol or chain               | `AdapterMetrics/`                                                          |
| `/chains` and `/chains/[category]`, the chain directory                           | `ChainsByCategory/`                                                        |
| `/fees/chains`, `/dexs/chains` and every other `/<metric>/chains` ranking         | `AdapterMetrics/`                                                          |
| `/`, `/chain/[chain]`, `/chart/chain/[chain]`, one chain                          | `ChainOverview/`; REV is not one of its charts (it lives on `/rev/chains`) |

## Rules

- `Subscription/shared/` is the public upsell and checkout surface (`SubscribeCards`, `StripeCheckoutModal`, `TopupModal`, `TrialCsvLimitModal`). Paywall gates elsewhere import from there; the rest of `Subscription/` is internal to the subscription product, and session state lives in `src/auth/`.
- Before changing a metric route, read `docs/metrics.md`.
