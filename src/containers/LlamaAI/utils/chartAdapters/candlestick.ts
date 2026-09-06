import type { ICandlestickChartProps } from '~/components/ECharts/CandlestickChart/types'
import { isChartDataRow, type ChartConfiguration, type ChartDataSeries } from '~/containers/LlamaAI/chartTypes'

export function adaptCandlestickData(
	config: ChartConfiguration,
	rawData: ChartDataSeries
): { data: ICandlestickChartProps['data']; indicators: ICandlestickChartProps['indicators'] } {
	let data: ICandlestickChartProps['data'] = []
	let indicators: ICandlestickChartProps['indicators'] = []

	if (!Array.isArray(rawData) || rawData.length === 0) {
		return { data, indicators }
	}

	const rows: Array<Record<string, unknown>> = []
	for (const row of rawData) {
		if (isChartDataRow(row)) rows.push(row)
	}
	const timeField = config.dataTransformation?.timeField
	const getTs = (row: Record<string, unknown>) => {
		const candidates = timeField ? [row[timeField], row.timestamp, row.date] : [row.timestamp, row.date]
		for (const raw of candidates) {
			if (raw == null) continue
			const t = Number(raw)
			if (Number.isFinite(t)) {
				return t < 1e12 ? t * 1000 : t
			}
			const d = new Date(String(raw)).getTime()
			if (Number.isFinite(d)) return d
		}
		return NaN
	}
	const timestampedRows: Array<{ row: Record<string, unknown>; timestamp: number }> = []
	for (const row of rows) {
		const timestamp = getTs(row)
		if (Number.isFinite(timestamp)) timestampedRows.push({ row, timestamp })
	}
	if (timestampedRows.length === 0) return { data, indicators }

	const sample = timestampedRows[0]?.row || {}
	const keys = Object.keys(sample)

	const metrics = config.dataTransformation?.metrics ?? []
	const ohlcFields = {
		open: metrics.find((m) => /open/i.test(m)) ?? 'open',
		high: metrics.find((m) => /high/i.test(m)) ?? 'high',
		low: metrics.find((m) => /low/i.test(m)) ?? 'low',
		close: metrics.find((m) => /close/i.test(m)) ?? 'close'
	}

	data = []
	for (const { row: r, timestamp } of timestampedRows) {
		data.push([
			timestamp,
			parseFloat(String(r[ohlcFields.open] ?? r.price ?? 0)),
			parseFloat(String(r[ohlcFields.close])),
			parseFloat(String(r[ohlcFields.low])),
			parseFloat(String(r[ohlcFields.high])),
			parseFloat(String(r.volume || 0))
		])
	}

	const bbUpper = keys.find((k) => k.includes('_bb_upper'))
	const bbMiddle = keys.find((k) => k.includes('_bb_middle'))
	const bbLower = keys.find((k) => k.includes('_bb_lower'))
	if (bbUpper && bbMiddle && bbLower) {
		let hasValidBB = false
		const values: NonNullable<ICandlestickChartProps['indicators']>[number]['values'] = []
		for (const { row: r, timestamp } of timestampedRows) {
			const u = parseFloat(String(r[bbUpper]))
			const m = parseFloat(String(r[bbMiddle]))
			const l = parseFloat(String(r[bbLower]))
			hasValidBB ||=
				(Number.isFinite(u) && u !== 0) || (Number.isFinite(m) && m !== 0) || (Number.isFinite(l) && l !== 0)
			values.push([
				timestamp,
				{
					upper: Number.isFinite(u) && u !== 0 ? u : null,
					middle: Number.isFinite(m) && m !== 0 ? m : null,
					lower: Number.isFinite(l) && l !== 0 ? l : null
				}
			])
		}
		if (hasValidBB) {
			indicators.push({
				name: 'BBands',
				category: 'overlay',
				data: [],
				values
			})
		}
	}

	const maFields = keys.filter((k) => /^(sma|ema|dema|tema|wma|vwap)_?\d*$/i.test(k))
	for (const field of maFields) {
		const indicatorData: NonNullable<ICandlestickChartProps['indicators']>[number]['data'] = []
		for (const { row, timestamp } of timestampedRows) {
			const v = parseFloat(String(row[field]))
			indicatorData.push([timestamp, Number.isFinite(v) ? v : null])
		}
		indicators.push({
			name: field.toUpperCase(),
			category: 'overlay',
			data: indicatorData
		})
	}

	const rsiField = keys.find((k) => /^rsi(_\d+)?$/i.test(k))
	if (rsiField) {
		const rsiData: NonNullable<ICandlestickChartProps['indicators']>[number]['data'] = []
		for (const { row, timestamp } of timestampedRows) {
			const v = parseFloat(String(row[rsiField]))
			rsiData.push([timestamp, Number.isFinite(v) ? v : null])
		}
		indicators.push({
			name: 'RSI',
			category: 'panel',
			data: rsiData
		})
	}

	const macdField = keys.find((k) => k === 'macd')
	const signalField = keys.find((k) => k === 'macd_signal')
	const histField = keys.find((k) => k === 'macd_histogram')
	if (macdField || signalField || histField) {
		let hasValidMACD = false
		const values: NonNullable<ICandlestickChartProps['indicators']>[number]['values'] = []
		for (const { row: r, timestamp } of timestampedRows) {
			const m = parseFloat(String(macdField ? r[macdField] : undefined))
			const s = parseFloat(String(signalField ? r[signalField] : undefined))
			const h = parseFloat(String(histField ? r[histField] : undefined))
			hasValidMACD ||= Number.isFinite(m) || Number.isFinite(s) || Number.isFinite(h)
			values.push([
				timestamp,
				{
					macd: Number.isFinite(m) ? m : null,
					signal: Number.isFinite(s) ? s : null,
					histogram: Number.isFinite(h) ? h : null
				}
			])
		}
		if (hasValidMACD) {
			indicators.push({
				name: 'MACD',
				category: 'panel',
				data: [],
				values
			})
		}
	}

	const stochK = keys.find((k) => k === 'stoch_k')
	const stochD = keys.find((k) => k === 'stoch_d')
	if (stochK || stochD) {
		let hasValidStoch = false
		const values: NonNullable<ICandlestickChartProps['indicators']>[number]['values'] = []
		for (const { row: r, timestamp } of timestampedRows) {
			const k = parseFloat(String(stochK ? r[stochK] : undefined))
			const d = parseFloat(String(stochD ? r[stochD] : undefined))
			hasValidStoch ||= Number.isFinite(k) || Number.isFinite(d)
			values.push([timestamp, { k: Number.isFinite(k) ? k : null, d: Number.isFinite(d) ? d : null }])
		}
		if (hasValidStoch) {
			indicators.push({
				name: 'Stoch',
				category: 'panel',
				data: [],
				values
			})
		}
	}

	return { data, indicators }
}
