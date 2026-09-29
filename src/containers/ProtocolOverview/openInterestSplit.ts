import type { IAdapterBreakdownChartData, IAdapterProtocolMetrics } from '~/containers/AdapterMetrics/api.types'
import { OPTIONS_OPEN_INTEREST_CATEGORY } from '~/containers/AdapterMetrics/constants'

export type ChildOpenInterest = Pick<IAdapterProtocolMetrics, 'defillamaId' | 'category' | 'total24h'>

const sumTotals = (children: ReadonlyArray<ChildOpenInterest>) => {
	const totals = children.map((child) => child.total24h).filter((total) => total != null)
	return totals.length === 0 ? null : totals.reduce((sum, total) => sum + total, 0)
}

// A parent's open-interest total and chart add up every child, so perp and options open interest
// are each summed from their own children, and the chart is split by version. optionsOpenInterestSeries
// is null without options OI, [] when the whole protocol is options, else the options series.
export function splitProtocolOpenInterest({
	protocol,
	children
}: {
	protocol: IAdapterProtocolMetrics
	children: ReadonlyArray<ChildOpenInterest>
}) {
	if (protocol.category === OPTIONS_OPEN_INTEREST_CATEGORY) {
		return { openInterest: null, optionsOpenInterest: protocol, optionsOpenInterestSeries: [] }
	}
	const options = children.filter((child) => child.category === OPTIONS_OPEN_INTEREST_CATEGORY)
	if (options.length === 0) {
		return { openInterest: protocol, optionsOpenInterest: null, optionsOpenInterestSeries: null }
	}

	const optionsIds = new Set(options.map((child) => child.defillamaId))
	const childProtocols = protocol.childProtocols ?? []
	const perpVersions = childProtocols.filter((child) => !optionsIds.has(child.defillamaId))
	const optionsVersions = childProtocols.filter((child) => optionsIds.has(child.defillamaId))

	return {
		openInterest:
			perpVersions.length === 0
				? null
				: {
						...protocol,
						total24h: sumTotals(children.filter((child) => !optionsIds.has(child.defillamaId))),
						chainBreakdown: null,
						childProtocols: perpVersions
					},
		optionsOpenInterest: {
			...protocol,
			total24h: sumTotals(options),
			chainBreakdown: null,
			childProtocols: optionsVersions
		},
		optionsOpenInterestSeries: [...new Set(optionsVersions.flatMap((child) => [child.displayName, child.name]))]
	}
}

/** Sums a protocol's version-breakdown chart over its options series, or over everything else. */
export function selectOpenInterestBreakdownSeries(
	chart: IAdapterBreakdownChartData,
	optionsSeries: ReadonlyArray<string>,
	select: 'options' | 'perps'
): Array<[number, number]> {
	const optionsNames = new Set(optionsSeries)
	const series: Array<[number, number]> = []
	for (const [timestamp, values] of chart) {
		let total: number | null = null
		for (const name in values) {
			const value = values[name]
			if (value == null || optionsNames.has(name) !== (select === 'options')) continue
			total = (total ?? 0) + value
		}
		if (total != null) series.push([timestamp, total])
	}
	return series
}
