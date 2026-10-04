# Focus, errors and lost work

An action that removes, replaces or disables the control that has focus drops focus to the page, and a keyboard reader starts over from the top. A request error that disappears while its retry runs takes its button with it. A draft held by a component that a view switch unmounts is lost without asking. The shared parts in `src/ui` handle each case once; this page says which one to reach for.

`scripts/policies/check-focus-handoff.ts` rejects the mechanical cases (a pending button disabled without `pendingLabel`, a field disabled while typing, and the rest listed in its header). The choices below are the ones it cannot make.

## Where focus goes when a control leaves

| When                                                              | Use                                                                                  | Example                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Anything inside a `Dialog` or `SideSheet`                         | Nothing: the surface's net (`catchLostFocus`) hands lost focus to its first control  | `src/ui/Dialog.tsx`                              |
| A synchronous change outside a dialog removes the pressed control | `keepFocus(commit, target)`                                                          | `DashboardFormFields.tsx`                        |
| A row leaves its list (remove, delete, unlink)                    | `neighbourRowControl(row, control)` as the target, computed before the change        | `src/components/FilterBuilderDialog.tsx`         |
| Data removes the control later and nothing takes its place        | `passFocusOnLeave(target)` as the control's ref                                      | `src/components/Nav/Account.tsx`                 |
| A Try again outside a dialog leaves once its read succeeds        | `focusRegionOnLeave` as its ref: the nearest `tabIndex={-1}` region, else `<main>`   | `ProCardStatus.tsx`, `RetryNotice.tsx`           |
| Something that loads later replaces the control                   | `takeLostFocus` as the replacement's ref                                             | `src/components/Search/index.tsx`                |
| A dialog closes                                                   | Nothing by default: its opener, else `<main>`. Pass `finalFocus` for a nearer target | `DashboardCard.tsx`, `DeletePortfolioButton.tsx` |
| A confirm's success removes the control that opened it            | `finalFocus` pointing at the neighbour, set in the confirm's `onSuccess`             | `ProjectsGrid.tsx`                               |

Inside a dialog, a handoff that only reproduces the net is redundant; outside one, a control that removes itself always hands focus on. Focus never lands on `<body>`, and `<main>` (`pageContent()`) is the last resort, not the default target.

A dialog records the control that opened it, and a click inside a dialog focuses the pressed button first, as Chrome does, so Safari and Firefox return focus to the right place too. Never read `Ariakit.useDialogContext()` to find "the dialog": inside a `TabPanel` it returns the panel's store. Use what the surface provides (`DialogCancelButton`, `DialogBackButton`, `useDialogLeave`).

## Errors and retries

| When                                                 | Use                                                                                                                                    | Example                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A read fails                                         | `queryReadFailed(query)` checked before loading, so a retry from an error keeps the error and its button on screen                     | `src/utils/query.ts`, `src/auth/useSubscribe.tsx`                              |
| Its Try again runs                                   | The same button with `pendingLabel={query.isFetching ? 'Retrying…' : null}`                                                            | `ProCardStatus.tsx`                                                            |
| An action fails                                      | One nullable error state, set in `onError` and cleared on success or an edit; never `mutation.error`, which clears when a retry starts | `src/containers/Account/CancelSubscriptionModal.tsx`                           |
| A confirm runs an action                             | `ConfirmActionDialog`: it owns the error and keeps it through a retry                                                                  | `src/ui/ConfirmActionDialog.tsx`                                               |
| An accepted action changes data (remove, save local) | The mutation's own `onSuccess`, which runs after the view unmounts                                                                     | `deletePortfolioWithNotifications` in `src/containers/DeFiWatchlist/index.tsx` |
| The dialog is gone when the request settles          | A toast, only then (`if (!ref.current?.isConnected) toast…`)                                                                           | `src/components/ReportIncorrectData/index.tsx`                                 |

A retry that hides its error removes the button that has focus, never shows its pending label, and moves the layout twice. Keep the error until the retry succeeds.

`ConfirmActionDialog`'s `onSuccess` and a `mutate()` call's own callbacks are skipped once the dialog or component has gone. Put only view work there: closing, focus, a redirect that only makes sense while the page is open. Work that belongs to the accepted action goes in the mutation's `onSuccess`, and it names its entity from the mutation's variables, never from state read at settle time.

## Lost work

- A draft lives in the component that stays mounted for the whole edit. A view switch inside a dialog (a detail view, a step, a tab) hides the editor instead of unmounting it, or lifts the draft above the switch.
- `DialogDiscardGuard when={dirty}` turns Escape, the ×, Cancel, Back and guarded steps into one "Discard?" question. Dirty means the draft differs from what the opening started with; opening a saved item without changing it is not dirty.
- Every exit goes through the surface: `DialogCancelButton` and `DialogBackButton` ask the guard and honour `pending`, and a step or tab switch that drops work calls `useDialogLeave()`. A plain `onClick={goBack}` skips the question.
- A pending request that cannot be cancelled passes `pending` to the dialog, which locks every exit without asking.

## Pickers

A multi-select row in `SelectWithCombobox` holds two `role="option"` items: the option and its "Only". Code that counts or indexes options skips `[aria-label^="Only "]`.
