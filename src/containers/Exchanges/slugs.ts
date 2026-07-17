const CANONICAL_EXCHANGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isCanonicalExchangeSlug(slug: string): boolean {
	return CANONICAL_EXCHANGE_SLUG.test(slug)
}
