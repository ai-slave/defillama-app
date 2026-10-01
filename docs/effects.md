# Effects

An effect synchronizes React with something outside it: a subscription, a timer, the DOM, a widget, the network. Anything else has a direct home, and an effect in its place renders a frame of wrong state, runs on a flag instead of the event the flag stands for, or loses work when the component remounts.

`.oxlintrc.json` rejects the mechanical cases (`react/no-deriving-state-in-effects`, `react/set-state-in-effect`). This page covers the choice the lint cannot make: where the work goes instead.

## Where the work goes

| To do this                                                | Use                                                                                                                               | Example                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Compute a value from props, state or the URL              | Derive it during render; `useMemo` only when it is expensive                                                                      | `variableOverrides` in `src/containers/ProDashboard/ProDashboardAPIContext.tsx`                                    |
| Start over when the entity changes                        | A `key` on the component whose state belongs to that entity, never a whole page keyed by route                                    | `<ArticleRenderer key={article.id}>` in `src/pages/research/[section]/[slug].tsx`                                  |
| Seed state from a prop once                               | A lazy initializer or reducer init, and a `key` or remount for a new value                                                        | `createInitialWizardState` in `ComparisonWizard/hooks/useComparisonWizard.ts`                                      |
| Keep a selection, filter or open dialog in the URL        | Read `router.query` during render; the handler writes the URL                                                                     | `CatalogView` in `src/containers/Downloads/DownloadsCatalog.tsx`, the comparison link store in `src/pages/pro.tsx` |
| Run work when an element mounts (measure, focus, observe) | A ref callback that returns its cleanup                                                                                           | `src/hooks/useHorizontalOverflow.ts`, `src/hooks/useInViewOnce.ts`, `TableFrame` `onContainerMount`                |
| React to a dialog or popover opening or closing           | The library's callback                                                                                                            | Ariakit `autoFocusOnShow`, `initialFocus`, `setMounted`                                                            |
| Respond to a click, submit or keypress                    | The event handler                                                                                                                 | `SearchBar` submit in `src/containers/Articles/landing/ResearchSearch.tsx`                                         |
| Respond to a request settling                             | The mutation's `onSuccess`/`onSettled`                                                                                            | `sendVerifyCode` in `src/auth/index.tsx`                                                                           |
| Load data                                                 | A React Query query keyed per entity                                                                                              | `src/containers/Downloads/sql/useDuckDB.ts`                                                                        |
| Measure data against its own period (last day, 7d window) | `usePageClockSec()` for page props, the query's `dataUpdatedAt` for fetched data                                                  | `src/containers/Hacks/index.tsx`; see `docs/date-formatting.md`                                                    |
| Relate now to something (countdown, age, expiry)          | `useNowSeconds`; `refreshNowSeconds()` after a deadline read from `Date.now()`                                                    | `src/ui/RelativeTime.tsx`, `sendVerifyCode` in `src/auth/index.tsx`                                                |
| Default a control from the clock (a calendar's month)     | Derive the default during render; only the reader's own pick goes in state, never a clock frozen at mount                         | `src/containers/Unlocks/TreemapChart/index.tsx`                                                                    |
| Edit a value the server also owns                         | A draft that is `null` while clean; render `draft ?? server`, set it on edit, and drop it once the server reports the saved value | `src/containers/LlamaAI/components/SettingsModal.tsx`                                                              |
| Hand a callback to a timer, listener or another hook      | `useStableCallback`; `useEffectEvent` only when its own component's effect calls it                                               | `reveal` in `src/containers/ProDashboard/hooks/useDashboardItemDeepLink.ts`                                        |
| Show a request's error                                    | Render it where the data would be, not a toast from an effect on `.error`                                                         | design.md → Status states                                                                                          |

Adjusting state during render (`if (prev !== value) { setPrev(value); setOther(...) }`) is the last resort, for when neither deriving from a stored id nor a `key` works. Comment why at the site.

## Before replacing an effect

An effect that looks like a derivation sometimes holds memory. Check these before deleting it:

- **First render:** the replacement produces the same output on the server, on the hydration render, and on the first client render. A static page has an empty `router.query` until hydration.
- **Bad value to good:** when a missing or invalid input becomes valid, decide whether the old value is forgotten or kept, for example through a failed refetch.
- **A→B→A:** Next keeps a page mounted across `[slug]` changes. B starts clean, and A comes back the way it did before. Anything captured once at mount, a clock included, still describes A.
- **Unsaved edits:** a server value that changes during an edit does not overwrite the draft; a clean draft follows the server.

## Effects that stay

- Subscriptions to the window, document, a store or a socket, with their cleanup.
- Pushing state into a widget React does not render, such as an editor's `setContent` or a chart instance.
- Timers and intervals.
- A request that page arrival itself causes, with no user event, guarded against Strict Mode's second run.
- Copying a server snapshot into an editable draft, when pending saves and freshness decide whether it applies.
