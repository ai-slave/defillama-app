import type { IProtocol } from './types'

export const sampleProtocol: IProtocol = {
	name: 'Pendle',
	slug: 'pendle',
	chains: ['Ethereum', 'Arbitrum', 'Optimism', 'Binance', 'BSC', 'OP Mainnet', 'Mantle', 'Base', 'Sonic', 'Berachain'],
	category: 'Yield',
	tvl: {
		default: {
			tvl: 3342618874.186361,
			tvlPrevDay: 3278311992.4107237,
			tvlPrevWeek: 3037305538.9910874,
			tvlPrevMonth: 3092652399.4909043
		},
		staking: {
			tvl: 208900390.34536666,
			tvlPrevDay: 196577023.94138634,
			tvlPrevWeek: 213657387.70061365,
			tvlPrevMonth: 173728082.37494668
		},
		pool2: {
			tvl: 1653011.7550280518,
			tvlPrevDay: 1555972.8199892591,
			tvlPrevWeek: 1685498.7409283835,
			tvlPrevMonth: 1377086.9400414496
		},
		doublecounted: {
			tvl: 3342618874.186361,
			tvlPrevDay: 3278311992.4107237,
			tvlPrevWeek: 3037305538.9910874,
			tvlPrevMonth: 3092652399.4909043
		}
	},
	tvlChange: {
		change1d: 1.961585167138066,
		change7d: 10.052111362385045,
		change1m: 8.082591976279152
	},
	mcap: 552591758.0142369,
	tokenPrice: 3.68,
	mcaptvl: 0.17,
	strikeTvl: true,
	fees: {
		total24h: 13689,
		total7d: 100059,
		total30d: 1148707,
		total1y: 19280143,
		annualized1y: 19280143,
		monthlyAverage1y: 1606678.5833333333,
		totalAllTime: 25640450,
		pf: 40.09
	},
	revenue: {
		total24h: 12581,
		total7d: 92307,
		total30d: 1133455,
		total1y: 19085881,
		annualized1y: 19085881,
		monthlyAverage1y: 1590490.0833333333,
		totalAllTime: 25287865,
		ps: 40.63
	},
	dexs: {
		total24h: 377779013,
		total7d: 1177832690,
		change_7dover7d: 194.74,
		totalAllTime: 22702816840
	}
}

const fieldAlias = (name: string, path: string) => ({ name, path, regex: new RegExp(`\\b${name}\\b`, 'g') })

const FIELD_ALIASES = [
	fieldAlias('mcap', 'mcap'),
	fieldAlias('tokenPrice', 'tokenPrice'),
	// TVL fields
	fieldAlias('tvl', 'tvl_default_tvl'),
	fieldAlias('tvlPrevDay', 'tvl_default_tvlPrevDay'),
	fieldAlias('tvlPrevWeek', 'tvl_default_tvlPrevWeek'),
	fieldAlias('tvlPrevMonth', 'tvl_default_tvlPrevMonth'),
	// TVL change fields
	fieldAlias('change_1d', 'tvlChange_change1d'),
	fieldAlias('change_7d', 'tvlChange_change7d'),
	fieldAlias('change_1m', 'tvlChange_change1m'),
	// Fees fields
	fieldAlias('fees_24h', 'fees_total24h'),
	fieldAlias('fees_7d', 'fees_total7d'),
	fieldAlias('fees_30d', 'fees_total30d'),
	fieldAlias('fees_1y', 'fees_total1y'),
	fieldAlias('average_fees_1y', 'fees_monthlyAverage1y'),
	fieldAlias('cumulativeFees', 'fees_totalAllTime'),
	fieldAlias('pf', 'fees_pf'),
	// Revenue fields
	fieldAlias('revenue_24h', 'revenue_total24h'),
	fieldAlias('revenue_7d', 'revenue_total7d'),
	fieldAlias('revenue_30d', 'revenue_total30d'),
	fieldAlias('revenue_1y', 'revenue_total1y'),
	fieldAlias('average_revenue_1y', 'revenue_monthlyAverage1y'),
	fieldAlias('cumulativeRevenue', 'revenue_totalAllTime'),
	fieldAlias('ps', 'revenue_ps'),
	// Dexs fields
	fieldAlias('volume_24h', 'dexs_total24h'),
	fieldAlias('volume_7d', 'dexs_total7d'),
	fieldAlias('volumeChange_7d', 'dexs_change_7dover7d'),
	fieldAlias('cumulativeVolume', 'dexs_totalAllTime')
]

export const AVAILABLE_FUNCTIONS = [
	{ name: 'abs', type: 'operator', args: 'x' },
	{ name: 'ceil', type: 'operator', args: 'x' },
	{ name: 'floor', type: 'operator', args: 'x' },
	{ name: 'round', type: 'operator', args: 'x' },
	{ name: 'roundTo', type: 'operator', args: 'x, n' },
	{ name: 'sqrt', type: 'operator', args: 'x' },
	{ name: 'not', type: 'operator', args: 'x' },
	{ name: 'min', type: 'function', args: 'a, b, ...' },
	{ name: 'max', type: 'function', args: 'a, b, ...' },
	{ name: 'if', type: 'function', args: 'c, a, b' }
]

export const AVAILABLE_FIELDS = FIELD_ALIASES.map((alias) => alias.name)

export function parseProtocolTableColumnVisibility(value: string | null): Record<string, boolean> {
	if (!value) return {}
	try {
		const parsed: unknown = JSON.parse(value)
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
		const visibility: Record<string, boolean> = {}
		for (const [key, isVisible] of Object.entries(parsed)) {
			if (typeof isVisible === 'boolean') visibility[key] = isVisible
		}
		return visibility
	} catch {
		return {}
	}
}

export function replaceAliases(formula: string): string {
	let result = formula
	for (const alias of FIELD_ALIASES) {
		result = result.replace(alias.regex, alias.path)
	}
	return result
}
