import type { IProtocol } from './types'

export const sampleProtocol: IProtocol = {
	name: 'Pendle',
	slug: 'pendle',
	chains: ['Ethereum', 'Arbitrum', 'Optimism', 'Binance', 'BSC', 'OP Mainnet', 'Mantle', 'Base', 'Sonic', 'Berachain'],
	category: 'Yield',
	tvl: {
		default: {
			tvl: 3_342_618_874.186361,
			tvlPrevDay: 3_278_311_992.4107237,
			tvlPrevWeek: 3_037_305_538.9910874,
			tvlPrevMonth: 3_092_652_399.4909043
		},
		staking: {
			tvl: 208_900_390.34536666,
			tvlPrevDay: 196_577_023.94138634,
			tvlPrevWeek: 213_657_387.70061365,
			tvlPrevMonth: 173_728_082.37494668
		},
		pool2: {
			tvl: 1_653_011.7550280518,
			tvlPrevDay: 1_555_972.8199892591,
			tvlPrevWeek: 1_685_498.7409283835,
			tvlPrevMonth: 1_377_086.9400414496
		},
		doublecounted: {
			tvl: 3_342_618_874.186361,
			tvlPrevDay: 3_278_311_992.4107237,
			tvlPrevWeek: 3_037_305_538.9910874,
			tvlPrevMonth: 3_092_652_399.4909043
		}
	},
	tvlChange: {
		change1d: 1.961585167138066,
		change7d: 10.052111362385045,
		change1m: 8.082591976279152
	},
	mcap: 552_591_758.0142369,
	tokenPrice: 3.68,
	mcaptvl: 0.17,
	strikeTvl: true,
	fees: {
		total24h: 13_689,
		total7d: 100_059,
		total30d: 1_148_707,
		total1y: 19_280_143,
		annualized1y: 19_280_143,
		monthlyAverage1y: 1_606_678.5833333333,
		totalAllTime: 25_640_450,
		pf: 40.09
	},
	revenue: {
		total24h: 12_581,
		total7d: 92_307,
		total30d: 1_133_455,
		total1y: 19_085_881,
		annualized1y: 19_085_881,
		monthlyAverage1y: 1_590_490.0833333333,
		totalAllTime: 25_287_865,
		ps: 40.63
	},
	dexs: {
		total24h: 377_779_013,
		total7d: 1_177_832_690,
		total30d: 4_820_195_300,
		change_7dover7d: 194.74,
		totalAllTime: 22_702_816_840
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
