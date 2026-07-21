export function buildBridgedInflowsChartData(inflows: Array<Record<string, number>>, tokenNames: string[]) {
	const source = new Array<Array<number>>(inflows.length)
	for (let i = 0; i < inflows.length; i++) {
		const entry = inflows[i]
		const row = new Array<number>(tokenNames.length + 1)
		row[0] = entry.date * 1e3
		for (let tokenIndex = 0; tokenIndex < tokenNames.length; tokenIndex++) {
			row[tokenIndex + 1] = entry[tokenNames[tokenIndex]]
		}
		source[i] = row
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', ...tokenNames]
		},
		charts: tokenNames.map((name, index) => ({
			type: 'bar' as const,
			name,
			encode: { x: 0, y: index + 1 },
			stack: 'tokenInflows',
			large: false
		}))
	}
}
