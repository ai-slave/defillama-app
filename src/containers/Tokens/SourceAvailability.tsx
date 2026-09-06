import type { TokensOptionalSource } from './types'

const SOURCE_NAMES: Record<TokensOptionalSource, string> = {
	markets: 'Markets',
	rights: 'Token rights',
	fees: 'Fees',
	revenue: 'Revenue',
	holdersRevenue: 'Holders revenue',
	unlocks: 'Unlocks'
}

export function TokensSourceAvailability({ sources }: { sources: Array<TokensOptionalSource> }) {
	if (sources.length === 0) return null
	return (
		<p role="status" className="px-3 py-2 body-sm text-secondary">
			{sources.map((source) => SOURCE_NAMES[source]).join(', ')} data unavailable. Affected values are unavailable, and
			filters using those values cannot give complete results.
		</p>
	)
}
