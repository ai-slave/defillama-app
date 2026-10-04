# Pro dashboards

A Pro dashboard is a JSON document the frontend owns. The server stores `data` as received, sanitizes only the `title` and `content` of `text` cards, and rejects a document over its size limit. Every read goes through `migrateDashboardConfig` in `dashboardConfig/migrate.ts`, which rebuilds each card from its persisted shape and drops cards it cannot read.

## Where the work goes

| To do this                            | Use                                                                                              | Example                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Add a document or card field          | An optional field whose absence equals the default; no document version                          | no `height` means scale 1                     |
| Change one card kind's shape          | That kind's `configVersion` and a migration in `dashboardConfig/migrations/`                     | `migrations/protocolsTable.ts`                |
| Accept a persisted value              | Validate it in `migrateDashboardConfig`; drop an invalid entry, never reject the document        | `variables` past `MAX_DASHBOARD_VARIABLES`    |
| Group cards into sections or tabs     | Flat `kind: 'section'` items; `buildDashboardLayout` derives groups from order                   | `displayAs: 'tab'`                            |
| Resolve parameters                    | `resolveDashboardItems` in `dashboardVariables/resolve.ts`                                       | `ProDashboardAPIContext.tsx`, `server/stream` |
| Store custom data rows                | Inline in the card, encoded past `CUSTOM_DATA_INLINE_ROWS_MAX_LENGTH`                            | `components/CustomData/rowsEncoding.ts`       |
| Check the document size before a save | `utils/dashboardDocumentSize.ts`, which mirrors the server's `JSON.stringify(data).length` check | `useDashboardActions.ts`                      |
| Resolve a save conflict               | `baseEditedAt` → 409 → `mergeDashboardItems`                                                     | `hooks/useDashboardAPI.ts`                    |
| Undo and redo                         | The reducer's history of `{ items, variables }` snapshots, capped at `DASHBOARD_HISTORY_LIMIT`   | `dashboardReducer.ts`                         |

## Checks

- Absence is never ambiguous, so a document `schemaVersion` would have nothing to discriminate. Old documents take the new shape on the owner's first save.
- Sections never nest. `buildDashboardLayout` groups the cards after a section until the next one; any tab section turns the cards before the first tab into a shared header. The 409 merge treats a section like any other card.
- `variables` hold defaults; cards keep their literals plus `bindings` (field → variable id). The client resolves on the way into `ChartGrid`; the server resolves after the protocol catalog loads and before it plans sources.
- An owner persists a variable value by rewriting the bound literals in the same save. A viewer overrides through `?var-<id>=…`, which also reaches the stream URL so edge cache variants stay correct. Search, SEO and AI iteration see real values.
- Custom data rows stay out of the SSR HTML and arrive with the stream's `dashboard` chunk.
- `variables` and `annotations` merge as whole top-level keys. The reducer keeps local edits of those keys when they differ from the save baseline.
- Undo history lives only in the tab; nothing is persisted, so a deleted card is recoverable until the tab closes.
- New text fields (section titles, parameter and annotation labels, custom data names and columns) bypass server sanitization and render as plain text only.

## Not here

- `components/UnifiedTable/` renders dashboard tables. Its config schema, column dictionary, defaults and migrations live in the sibling `unifiedTable/` folder.
