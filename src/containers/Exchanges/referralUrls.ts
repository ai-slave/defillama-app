// Emergency frontend overrides only. Referral links are owned by the backend
// (orderbook-watch STATIC_REF_LINKS + authored meta ref_links) and arrive
// resolved in every payload's `links.website`. Add a slug here ONLY when a
// referral must change faster than the backend cache can rebuild — and remove
// it again once the backend carries the fix. Keys are public route slugs.
export const EXCHANGE_REFERRAL_URLS: Readonly<Partial<Record<string, string>>> = {}
