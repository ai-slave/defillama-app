# Rewards

Rewards owns `/rewards`: the program directory, its ranking, the featured cards and the page's analytics events. The Umami script and the A/B cookie belong to `src/utils/analytics/umami.ts` and `src/utils/abTesting.ts`.

## Where the logic lives

| To change                                                  | Edit                                          | Notes                                                 |
| ---------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| Ranking, eligibility and generation failures               | `buildRewardsPageData` in `queries.server.ts` |                                                       |
| URL filters                                                | `query.ts`                                    |                                                       |
| Interaction event names                                    | `src/utils/analytics/rewards.ts`              | `REWARDS_EVENTS`, plus the queue until Umami is ready |
| Impression, outbound click, exposure and conversion events | `useRewardsAnalytics.ts`                      |                                                       |

## Rules

### Ranking

- Only public, published programs appear, ended ones included.
- Programs with a positive integer `featured_rank` come first, in rank order.
- The rest sort by canonical project-page views from `rewards-popularity.json`, then alphabetically. Unmeasured projects follow measured zeroes.
- Programs of one project share that project's view count.

### Generation failures

- An invalid or duplicate `featured_rank` or `featured_rank_card` fails page generation, so ISR keeps the previous page instead of publishing an ambiguous order.
- A catalog record without `project_path` fails generation, because it means an old producer. An explicit `null` is valid for an unresolved project.

### Page state

- Page props never carry ranks or view counts. The server sends programs plus ordered IDs (`popularityOrder`, `featuredCardIds`).
- Status, reward type and Hide unverified live in the URL. Sort, search and pagination stay local, and sort params in the URL are ignored.
- Reset restores the assigned variant's server order.

### Featured cards

- `rewards-featured-cards-v1` assigns variants through the site's A/B cookie. Variant A keeps every `featured_rank` promotion. Variant B sorts the whole table by views and shows up to three cards ordered by `featured_rank_card`.
- Card programs stay in B's table.
- The card section hides while search, status, reward type or Hide unverified is active. Whitespace-only search counts as empty.
- Card copy and referral links come from the catalog, never from code.

### Analytics

- Event names and properties are a contract with the Umami analysis. Renaming an event or changing a property breaks comparisons across releases.
- Every event carries `experiment` and `variant`. Program events add `program_id`, nullable `project_path` and `placement` (`card` or `table`).
- No event carries a referral URL or source link. Only `rewards-search` carries the search term, trimmed and lowercased.
- An impression needs 50% visibility for one continuous second while the document is visible, and counts once per program, placement and variant per tab session.
- Exposure and conversion fire once per variant per tab session, so repeat clicks cannot inflate the conversion rate.
- Events wait in memory until Umami is ready and are dropped if the page unmounts first, because Umami credits an event to the page current at send time.
