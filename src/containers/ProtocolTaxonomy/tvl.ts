import { PROTOCOL_LIST_ADDITIVE_TVL_KEYS } from '~/containers/ProtocolLists/api.types'
import { getPercentChange } from '~/utils'
import type { IProtocolTaxonomyPageData, IProtocolsCategoriesPageData, IProtocolsCategoriesTableRow } from './types'

type ProtocolTaxonomyProtocol = IProtocolTaxonomyPageData['protocols'][number]
type ProtocolsCategoriesChartState = {
	dataset: {
		source: Array<Array<number | null>>
		dimensions: Array<string>
	}
	charts: Array<{
		type: 'line'
		name: string
		encode: { x: 0; y: number }
		stack: 'stackA'
		color: string
	}>
}

function getEnabledExtraTvlValueSum(
	extraTvls: Record<string, number | null | undefined>,
	enabledTvls: Array<string>
): { sum: number | null; hasValue: boolean } {
	let extraSum: number | null = 0
	let hasValue = false
	for (const extraTvlKey of enabledTvls) {
		if (!Object.hasOwn(extraTvls, extraTvlKey)) continue
		hasValue = true
		const extraTvl = extraTvls[extraTvlKey] ?? null
		extraSum = extraSum === null || extraTvl === null ? null : extraSum + extraTvl
	}
	return { sum: extraSum, hasValue }
}

function sumEnabledExtraTvlChartValues(
	extraTvlCharts: Record<string, Record<string | number, number | null | undefined> | undefined> | undefined,
	enabledTvls: Array<string>,
	timestamp: string | number
): number | null {
	let extraSum: number | null = 0
	for (const extraTvlKey of enabledTvls) {
		const chart = extraTvlCharts?.[extraTvlKey]
		if (!chart || !Object.hasOwn(chart, timestamp)) continue
		const extraValue = chart[timestamp] ?? null
		extraSum = extraSum === null || extraValue === null ? null : extraSum + extraValue
	}
	return extraSum
}

function addEnabledCategoryRowExtraTvls(
	row: IProtocolsCategoriesTableRow,
	enabledTvls: Array<string>
): Pick<IProtocolsCategoriesTableRow, 'tvl' | 'tvlPrevDay' | 'tvlPrevWeek' | 'tvlPrevMonth'> {
	let tvl = row.tvl
	let tvlPrevDay = row.tvlPrevDay
	let tvlPrevWeek = row.tvlPrevWeek
	let tvlPrevMonth = row.tvlPrevMonth

	for (const extraTvlKey of enabledTvls) {
		const extraTvl = row.extraTvls[extraTvlKey]
		if (extraTvl === undefined) continue
		tvl = tvl === null || extraTvl.tvl === null ? null : tvl + extraTvl.tvl
		tvlPrevDay = tvlPrevDay === null || extraTvl.tvlPrevDay === null ? null : tvlPrevDay + extraTvl.tvlPrevDay
		tvlPrevWeek = tvlPrevWeek === null || extraTvl.tvlPrevWeek === null ? null : tvlPrevWeek + extraTvl.tvlPrevWeek
		tvlPrevMonth = tvlPrevMonth === null || extraTvl.tvlPrevMonth === null ? null : tvlPrevMonth + extraTvl.tvlPrevMonth
	}

	return { tvl, tvlPrevDay, tvlPrevWeek, tvlPrevMonth }
}

export function getEnabledProtocolTaxonomyTvls(tvlSettings: Record<string, boolean>) {
	return PROTOCOL_LIST_ADDITIVE_TVL_KEYS.filter((key) => tvlSettings[key])
}

export function getEnabledProtocolsCategoriesTvls(tvlSettings: Record<string, boolean>) {
	return PROTOCOL_LIST_ADDITIVE_TVL_KEYS.filter((key) => tvlSettings[key])
}

export function applyProtocolTaxonomyTvlSettings({
	protocols,
	charts,
	extraTvlCharts,
	tvlSettings
}: {
	protocols: IProtocolTaxonomyPageData['protocols']
	charts: IProtocolTaxonomyPageData['charts']
	extraTvlCharts: IProtocolTaxonomyPageData['extraTvlCharts']
	tvlSettings: Record<string, boolean>
}): {
	finalProtocols: IProtocolTaxonomyPageData['protocols']
	charts: IProtocolTaxonomyPageData['charts']
} {
	const enabledTvls = getEnabledProtocolTaxonomyTvls(tvlSettings)

	if (enabledTvls.length === 0) return { finalProtocols: protocols, charts }

	const finalProtocols = protocols.map((protocol) => applyProtocolRowTvlSettings(protocol, enabledTvls))
	const tvlIndex = charts.dataset.dimensions.indexOf('TVL')
	const finalSource: IProtocolTaxonomyPageData['charts']['dataset']['source'] = charts.dataset.source.map((row) => {
		const timestampKey = row[0]
		const extraSum = sumEnabledExtraTvlChartValues(extraTvlCharts, enabledTvls, timestampKey)

		const baseTvlValue = row[tvlIndex]
		const nextTvlValue = typeof baseTvlValue === 'number' && extraSum !== null ? baseTvlValue + extraSum : null
		const nextRow: typeof row = [timestampKey]
		for (const value of row.slice(1)) nextRow.push(value)
		nextRow[tvlIndex] = nextTvlValue

		return nextRow
	})

	return {
		finalProtocols,
		charts: {
			...charts,
			dataset: { ...charts.dataset, source: finalSource }
		}
	}
}

function applyProtocolRowTvlSettings(
	protocol: ProtocolTaxonomyProtocol,
	enabledTvls: Array<string>
): ProtocolTaxonomyProtocol {
	const extraTvl = getEnabledExtraTvlValueSum(protocol.extraTvls, enabledTvls)
	const tvl =
		extraTvl.hasValue && protocol.tvl != null && extraTvl.sum !== null ? protocol.tvl + extraTvl.sum : protocol.tvl
	const exactTvl = extraTvl.hasValue && extraTvl.sum === null ? null : tvl

	const updated = { ...protocol, tvl: exactTvl }
	const subRows = updated.subRows
	if (subRows && subRows.length > 0) {
		updated.subRows = subRows.map((subRow) => applyProtocolRowTvlSettings(subRow, enabledTvls))
	}
	return updated
}

export function buildProtocolsCategoriesTvlCharts({
	categories,
	categoryColors,
	chartSource,
	extraTvlCharts,
	enabledTvls
}: {
	categories: IProtocolsCategoriesPageData['categories']
	categoryColors: IProtocolsCategoriesPageData['categoryColors']
	chartSource: IProtocolsCategoriesPageData['chartSource']
	extraTvlCharts: IProtocolsCategoriesPageData['extraTvlCharts']
	enabledTvls: Array<string>
}): ProtocolsCategoriesChartState {
	const source = chartSource.map((row) => {
		const adjustedRow = new Array<number | null>(categories.length + 1)
		adjustedRow[0] = row.timestamp

		for (let index = 0; index < categories.length; index++) {
			const categoryName = categories[index]
			if (categoryName === undefined) continue
			const baseValue = row[categoryName]
			const extraTvlValue =
				enabledTvls.length === 0
					? 0
					: sumEnabledExtraTvlChartValues(extraTvlCharts[categoryName], enabledTvls, row.timestamp)

			adjustedRow[index + 1] =
				typeof baseValue === 'number' && extraTvlValue !== null ? baseValue + extraTvlValue : null
		}

		return adjustedRow
	})

	const dimensions = ['timestamp', ...categories]
	const charts = categories.map((categoryName, index) => ({
		type: 'line' as const,
		name: categoryName,
		encode: { x: 0 as const, y: index + 1 },
		stack: 'stackA' as const,
		color: categoryColors[categoryName] ?? '#999999'
	}))

	return { dataset: { source, dimensions }, charts }
}

export function applyProtocolsCategoriesTvlSettings({
	tableData,
	enabledTvls
}: {
	tableData: IProtocolsCategoriesPageData['tableData']
	enabledTvls: Array<string>
}): IProtocolsCategoriesPageData['tableData'] {
	if (enabledTvls.length === 0) return tableData

	return tableData.map((row) => applyProtocolsCategoriesRowTvlSettings(row, enabledTvls))
}

function applyProtocolsCategoriesRowTvlSettings(
	row: IProtocolsCategoriesTableRow,
	enabledTvls: Array<string>
): IProtocolsCategoriesTableRow {
	const { tvl, tvlPrevDay, tvlPrevWeek, tvlPrevMonth } = addEnabledCategoryRowExtraTvls(row, enabledTvls)

	const updatedRow: IProtocolsCategoriesTableRow = {
		...row,
		tvl,
		tvlPrevDay,
		tvlPrevWeek,
		tvlPrevMonth,
		change_1d: getPercentChange(tvl, tvlPrevDay),
		change_7d: getPercentChange(tvl, tvlPrevWeek),
		change_1m: getPercentChange(tvl, tvlPrevMonth)
	}

	if (row.subRows != null && row.subRows.length > 0) {
		updatedRow.subRows = row.subRows.map((subRow) => applyProtocolsCategoriesRowTvlSettings(subRow, enabledTvls))
	}

	return updatedRow
}
