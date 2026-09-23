import { slug } from '~/utils'

/** Gecko id behind a symbol's logo, from the token directory; undefined when it has none. */
export async function getGeckoIdResolver(): Promise<(symbol: string) => string | undefined> {
	const { tokenDirectory } = (await import('~/utils/metadata')).default
	return (symbol) => tokenDirectory[slug(symbol)]?.token_nk?.replace('coingecko:', '')
}
