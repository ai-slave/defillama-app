import { createChartRow } from '~/components/ECharts/dynamicRow'

export function buildBridgedInflowsChartData(inflows: Array<Record<string, number>>, tokenNames: string[]) {
	const selectedTokens = new Set(tokenNames)
	const source = new Array<Record<string, number>>(inflows.length)
	for (let i = 0; i < inflows.length; i++) {
		const entry = inflows[i]
		const row = createChartRow<number>(entry.date * 1e3)
		for (const name in entry) {
			if (name !== 'date' && selectedTokens.has(name)) row[name] = entry[name]
		}
		source[i] = row
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', ...tokenNames]
		},
		charts: tokenNames.map((name) => ({
			type: 'bar' as const,
			name,
			encode: { x: 'timestamp', y: name },
			stack: 'tokenInflows',
			large: false
		}))
	}
}
