import { Readable, type Writable } from 'node:stream'
import QueryStream from 'pg-query-stream'
import type { ChartBuilderCsvRequest } from '~/containers/ProDashboard/chartBuilderCsvContract'
import { getTimePeriodBounds } from '~/containers/ProDashboard/timePeriod'
import type { DashboardGrouping } from '~/containers/ProDashboard/types'
import { llamaDb } from '~/server/db/llama'
import { serializeCsvRow } from '~/utils/csv'
import type { CsvCell } from '~/utils/csvCell'
import { getCsvPeriodCells, getCsvPeriodHeaders, getGroupedTimestampSec } from '../../utils'
import { isoDateFromTimestamp, percentageValues, writeCsvChunk } from './csvStream'

export type SnapshotCsvEntity = { key: string; label: string }

type SnapshotValueRow = {
	date: string
	value: number | null
}

interface SnapshotCsvQuery<Row extends SnapshotValueRow> {
	query: string
	params: Array<unknown>
	entities: Array<SnapshotCsvEntity>
	getEntityKey: (row: Row) => string
	grouping: DashboardGrouping
	displayAs: 'timeSeries' | 'percentage'
	treemap: boolean
	aggregation?: 'snapshot' | 'flow'
	treemapValue?: 'latest' | 'sum7d' | 'sum30d'
	output: Writable
}

export function getCsvDateBounds(request: ChartBuilderCsvRequest): {
	startDate: string | null
	endDate: string | null
} {
	const bounds = getTimePeriodBounds(request.timePeriod, request.customTimePeriod)
	if (!bounds) return { startDate: null, endDate: null }
	return {
		startDate: isoDateFromTimestamp(bounds.start),
		endDate: Number.isFinite(bounds.end) ? isoDateFromTimestamp(bounds.end) : null
	}
}

function timestampFromIsoDate(date: string): number {
	return Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000)
}

function csvRow(periodCells: Array<string>, values: Array<number | undefined>, percentage: boolean): Array<CsvCell> {
	return [...periodCells, ...(percentage ? percentageValues(values) : values)]
}

export async function streamSnapshotCsv<Row extends SnapshotValueRow>({
	query,
	params,
	entities,
	getEntityKey,
	grouping,
	displayAs,
	treemap,
	aggregation = 'snapshot',
	treemapValue = 'latest',
	output
}: SnapshotCsvQuery<Row>): Promise<number> {
	if (entities.length === 0) return 0
	const entityIndex = new Map(entities.map((entity, index) => [entity.key, index]))
	if (!treemap) {
		await writeCsvChunk(
			output,
			`${serializeCsvRow([...getCsvPeriodHeaders(grouping), ...entities.map((entity) => entity.label)])}\n`
		)
	}

	let currentDate: string | null = null
	let currentValues = new Array<number | undefined>(entities.length)
	let groupedTimestamp: number | null = null
	let groupedValues = new Array<number | undefined>(entities.length)
	const treemapDates: Array<{ timestamp: number; values: Array<number | undefined> }> = []
	let emittedRows = 0

	const writeTimeSeriesRow = async (timestamp: number, values: Array<number | undefined>) => {
		await writeCsvChunk(
			output,
			`${serializeCsvRow(csvRow(getCsvPeriodCells(timestamp, grouping), values, displayAs === 'percentage'))}\n`
		)
		emittedRows++
	}

	const flushDate = async () => {
		if (currentDate === null) return
		if (treemap) {
			const timestamp = timestampFromIsoDate(currentDate)
			treemapDates.push({ timestamp, values: currentValues })
			const oldestNeeded = timestamp - 29 * 86_400
			while (treemapDates[0] && treemapDates[0].timestamp < oldestNeeded) treemapDates.shift()
			return
		}
		const nextGroupedTimestamp = getGroupedTimestampSec(timestampFromIsoDate(currentDate), grouping)
		if (grouping === 'day') {
			await writeTimeSeriesRow(nextGroupedTimestamp, currentValues)
			return
		}
		if (groupedTimestamp !== null && groupedTimestamp !== nextGroupedTimestamp) {
			await writeTimeSeriesRow(groupedTimestamp, groupedValues)
			if (aggregation === 'flow') groupedValues = new Array<number | undefined>(entities.length)
		}
		groupedTimestamp = nextGroupedTimestamp
		if (aggregation === 'snapshot') {
			// Snapshot metrics use the final date in each selected period without carrying stale entity values.
			groupedValues = currentValues
		} else {
			for (let index = 0; index < currentValues.length; index++) {
				const value = currentValues[index]
				if (value !== undefined) groupedValues[index] = (groupedValues[index] ?? 0) + value
			}
		}
	}

	const queryStream = new QueryStream(query, params, { batchSize: 1000 })
	await llamaDb.stream(queryStream, (stream) => {
		stream.on('data', (row: Row) => {
			stream.pause()
			void (async () => {
				if (currentDate !== row.date) {
					await flushDate()
					currentDate = row.date
					currentValues = new Array<number | undefined>(entities.length)
				}
				if (row.value !== null) {
					const index = entityIndex.get(getEntityKey(row))
					if (index !== undefined) currentValues[index] = (currentValues[index] ?? 0) + row.value
				}
				stream.resume()
			})().catch((error) => {
				if (stream instanceof Readable) stream.destroy(error instanceof Error ? error : new Error(String(error)))
			})
		})
	})
	await flushDate()

	if (treemap) {
		const latest = treemapDates.at(-1)
		if (!latest) return 0
		const days = treemapValue === 'sum7d' ? 7 : treemapValue === 'sum30d' ? 30 : 1
		const windowStart = latest.timestamp - (days - 1) * 86_400
		groupedValues = new Array<number | undefined>(entities.length)
		for (const date of treemapDates) {
			if (date.timestamp < windowStart) continue
			for (let index = 0; index < date.values.length; index++) {
				const value = date.values[index]
				if (value === undefined) continue
				if (aggregation === 'snapshot' || treemapValue === 'latest') groupedValues[index] = value
				else groupedValues[index] = (groupedValues[index] ?? 0) + value
			}
		}
		const valueLabel = treemapValue === 'sum7d' ? 'Sum 7d' : treemapValue === 'sum30d' ? 'Sum 30d' : 'Last day (1d)'
		await writeCsvChunk(output, `${serializeCsvRow(['Name', valueLabel])}\n`)
		for (let index = 0; index < entities.length; index++) {
			const entity = entities[index]
			const value = groupedValues[index]
			if (!entity || value === undefined || value <= 0) continue
			await writeCsvChunk(output, `${serializeCsvRow([entity.label, value])}\n`)
			emittedRows++
		}
	} else if (grouping !== 'day' && groupedTimestamp !== null) {
		await writeTimeSeriesRow(groupedTimestamp, groupedValues)
	}
	return emittedRows
}
