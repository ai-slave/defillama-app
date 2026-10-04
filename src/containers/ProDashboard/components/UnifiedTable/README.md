# Unified dashboard tables

Saved table configuration, its migrations and the row contracts live in `src/containers/ProDashboard/unifiedTable/` (`config/`, `contracts.ts`, `protocolCapabilities.ts`).

- `useUnifiedTableReadModel.ts` owns fetching, stream readiness, deferred search, filtering, and read-model construction. It has no TanStack Table dependency.
- `readModel.ts`, `utils/aggregation.ts`, and `utils/dataFilters.ts` define economic grouping, metric calculations, and filtering rules.
- `core/useUnifiedTable.ts` selects columns and required share metrics, and owns sorting, expansion, and pagination. It subscribes to state changes because it returns rendered row and header snapshots.
- `core/UnifiedVirtualTable.tsx` renders those snapshots with container scrolling.

Pipeline order matters: source filters, deferred search, economic grouping, aggregate filters, then filtered shares. Shares use surviving economic rows before pagination. Canonical chain totals apply only to the unfiltered all-protocols chain view; subset views use partial totals.

Background query failures retain existing rows; an initial failure is distinct from an empty result. Listing-age filters use the query's update timestamp. Search and requested shares do not themselves change query identity; configuration edits can request additional metric families.
