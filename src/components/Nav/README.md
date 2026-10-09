# Navigation

## Where the work goes

| To do this                         | Use                                                                                                                 | Example               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Add a main destination             | An entry in `public/pages.json`; `NavItems` renders it with `LinkToPage`                                            | `PrimaryNavLinks.tsx` |
| Add an expandable main destination | An entry with `children`, rendered by `PrimaryNavGroup` with the same `navLinkStyles` and `NavItemContent` as links | Equities              |
| Separate sidebar sections          | `SidebarDivider`                                                                                                    | `shared.tsx`          |
| Change the menu-layout-v1 variants | `menuVariant.ts`; its events and their contract live in `menuAnalytics.ts`                                          | `MENU_VARIANT_B`      |

## Checks

- Primary groups form an accordion: opening one closes the open group, and clicking it again closes it. `groupState.ts` holds the state outside the page layout, so desktop and mobile share it per variant.
- Navigating to a grouped destination opens its group. A fresh load of a page outside the groups starts with every group closed.
- A remount on the same pathname keeps a manual open or close choice; a completed navigation to another pathname drops it.
- Native disclosure toggles (find-in-page, text highlighting) update the shared state, but a toggle event that already matches the controlled `open` prop is ignored.
- Your Dashboards is a disclosure, open by default. Closing it is stored, so it stays closed across navigation, reloads and the phone menu.
- Group rows keep the inherited font size and weight, primary text, 16px icons and a 12px icon gap, on desktop and mobile alike.
- A child destination stays selected on its subpages. An overview matches exactly only when its siblings are its own subroutes, such as Equities rankings next to sectors.
- The active destination carries `aria-current`.
- An icon-only navigation control needs an explicit accessible label, even with a tooltip.
- Long group labels wrap so their full names stay readable; ordinary destination links truncate.
- `label-sm text-secondary` is only for section headings and utility groups.
- Aligned child labels drop their icons and indent with `pl-7` to match the 16px icon and 12px gap. The guide line beside them is an absolute pseudo-element, so its border never offsets the labels.
- Sidebar scroll containers clip horizontally, so a long pinned label or a capped divider never adds a horizontal scrollbar.
- Nav borders use the semantic border tokens, never black or white opacity classes.
