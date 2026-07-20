export interface IEquityTickerCountry {
	ticker: string
	country: string
}

export function buildEquityTickerCountrySlug(ticker: string, country: string): string {
	return `${ticker}:${country}`
}

export function parseEquityTickerCountrySlug(slug: string): IEquityTickerCountry | null {
	const parts = slug.split(':')
	if (parts.length !== 2) return null

	const [ticker, country] = parts
	return ticker && country ? { ticker, country } : null
}

export function parseEquityTickerCountryParam(param: string): IEquityTickerCountry | null {
	return parseEquityTickerCountrySlug(param) ?? (param ? { ticker: param, country: 'US' } : null)
}
