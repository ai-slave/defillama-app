import { prepareRuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { calculateTotalWithExtraToggles } from '~/utils/tvlOverlap'
import type { OracleBreakdownItem, OraclesByChainPageData } from './types'

export function getTopMeasuredOracleProtocol<T extends { tvl: number | null }>(protocols: ReadonlyArray<T>): T | null {
	let topProtocol: T | null = null
	for (const protocol of protocols) {
		if (protocol.tvl === null) continue
		if (topProtocol === null || topProtocol.tvl === null || protocol.tvl > topProtocol.tvl) {
			topProtocol = protocol
		}
	}
	return topProtocol
}

interface OracleDominanceChart {
	type: 'line'
	name: string
	encode: { x: number; y: number }
	color: string
	stack: string
}

function indexExtraChartDataByTimestamp(extraBreakdownsByApiKey: Record<string, Array<OracleBreakdownItem>>) {
	const indexedByTimestamp = new Map<number, Record<string, Record<string, number>>>()

	for (const apiKey in extraBreakdownsByApiKey) {
		const breakdown = extraBreakdownsByApiKey[apiKey]
		if (!breakdown) continue
		for (const dayData of breakdown) {
			const timestamp = dayData.timestamp
			const valuesByOracle = indexedByTimestamp.get(timestamp) ?? {}

			for (const oracleName in dayData) {
				if (oracleName === 'timestamp') continue
				const value = dayData[oracleName]
				if (value === undefined) continue
				const currentValues = valuesByOracle[oracleName] ?? {}
				currentValues[apiKey] = value
				valuesByOracle[oracleName] = currentValues
			}

			indexedByTimestamp.set(timestamp, valuesByOracle)
		}
	}

	return indexedByTimestamp
}

function calculateTotalWithOracleExtras({
	tvl,
	extraTvl,
	extraTvlsEnabled
}: {
	tvl: number | null
	extraTvl: Record<string, number> | undefined
	extraTvlsEnabled: Record<string, boolean>
}) {
	if (tvl === null) return null
	if (!extraTvl) return tvl

	const values: Record<string, number> = { tvl }
	for (const extraKey in extraTvl) {
		const extraValue = extraTvl[extraKey]
		if (extraValue === undefined) continue
		values[extraKey] = extraValue
	}

	return calculateTotalWithExtraToggles({ values, extraTvlsEnabled })
}

export function buildOraclesByChainTableAndPieData({
	tableData,
	extraTvlsEnabled,
	hasEnabledExtras
}: {
	tableData: OraclesByChainPageData['tableData']
	extraTvlsEnabled: Record<string, boolean>
	hasEnabledExtras: boolean
}) {
	if (!hasEnabledExtras) {
		const pieInput: Array<{ name: string; value: number }> = []
		for (const row of tableData) {
			if (row.tvl !== null) pieInput.push({ name: row.name, value: row.tvl })
		}

		return {
			tableData,
			pieSeries: prepareRuntimePieChartData({ data: pieInput, limit: 5 })
		}
	}

	const tableDataWithAdjustedTvl: OraclesByChainPageData['tableData'] = []
	for (const row of tableData) {
		tableDataWithAdjustedTvl.push({
			...row,
			tvl: calculateTotalWithOracleExtras({
				tvl: row.tvl,
				extraTvl: row.extraTvl,
				extraTvlsEnabled
			})
		})
	}
	tableDataWithAdjustedTvl.sort((a, b) => {
		if (a.tvl === null) return b.tvl === null ? 0 : 1
		if (b.tvl === null) return -1
		return b.tvl - a.tvl
	})

	const pieInput: Array<{ name: string; value: number }> = []
	for (const row of tableDataWithAdjustedTvl) {
		if (row.tvl !== null) pieInput.push({ name: row.name, value: row.tvl })
	}

	return {
		tableData: tableDataWithAdjustedTvl,
		pieSeries: prepareRuntimePieChartData({ data: pieInput, limit: 5 })
	}
}

export function buildOraclesByChainDominanceData({
	chartData,
	oracles,
	oraclesColors,
	extraBreakdownsByApiKey,
	extraTvlsEnabled,
	shouldApplyExtraTvlFormatting
}: {
	chartData: OraclesByChainPageData['chartData']
	oracles: OraclesByChainPageData['oracles']
	oraclesColors: OraclesByChainPageData['oraclesColors']
	extraBreakdownsByApiKey: Record<string, Array<OracleBreakdownItem>>
	extraTvlsEnabled: Record<string, boolean>
	shouldApplyExtraTvlFormatting: boolean
}) {
	const extraValuesByTimestamp = shouldApplyExtraTvlFormatting
		? indexExtraChartDataByTimestamp(extraBreakdownsByApiKey)
		: null
	const dimensions = ['timestamp', ...oracles]
	const source: Array<Array<number | null>> = []

	for (const baseDayData of chartData) {
		const timestampInSeconds = baseDayData.timestamp
		const extraValuesForTimestamp = extraValuesByTimestamp?.get(timestampInSeconds)

		const point = new Array<number | null>(oracles.length + 1)
		point[0] = timestampInSeconds * 1e3
		let hasValue = false
		let oracleDimension = 1
		for (const oracleName of oracles) {
			const oracleTvs = shouldApplyExtraTvlFormatting
				? calculateTotalWithOracleExtras({
						tvl: baseDayData[oracleName] ?? null,
						extraTvl: extraValuesForTimestamp?.[oracleName],
						extraTvlsEnabled
					})
				: (baseDayData[oracleName] ?? null)
			point[oracleDimension] = oracleTvs
			if (oracleTvs !== null) hasValue = true
			oracleDimension++
		}
		if (!hasValue) continue
		source.push(point)
	}

	const dominanceCharts: Array<OracleDominanceChart> = []
	let oracleDimension = 1
	for (const name of oracles) {
		dominanceCharts.push({
			type: 'line',
			name,
			encode: { x: 0, y: oracleDimension },
			color: oraclesColors[name] ?? '#ccc',
			stack: 'dominance'
		})
		oracleDimension++
	}

	return {
		dominanceCharts,
		dominanceDataset: { source, dimensions }
	}
}
