import type { RWAPerpsContractOverlayRow } from './api.types'
import type { IRWAPerpsMarket } from './Perps/api.types'
import { toRWAPerpsContractOverlayRow } from './perpsOverlay'

/**
 * The perps pages ship their markets column-packed: one array per field instead of one object per market, so a key
 * name travels once, and a text column with few distinct values travels as a dictionary plus indexes. Numbers travel
 * with six significant digits, whole dollars kept. Unpacking rebuilds the row the overlay mapper builds.
 */

/** One field's values in row order: plain, or a dictionary of distinct values and an index per row (-1 is null). */
type RWAPackedPerpsColumn = Array<unknown> | { dict: Array<unknown>; idx: Array<number> }

export type RWAPackedPerpsMarkets = { count: number; columns: Record<string, RWAPackedPerpsColumn> }

/** Every key the overlay row has, read from the mapper itself so a new field never goes missing. */
const ROW_KEYS = Object.keys(toRWAPerpsContractOverlayRow({} as IRWAPerpsMarket))

/** Fields the unpacker derives, so they never travel. */
const DERIVED_KEYS = new Set(['kind', 'detailHref', 'type', 'trueRWA'])

/** Six significant digits; from 100,000 up that is the whole number, so dollars are never cut. */
function roundForPayload(value: number): number {
	return Math.abs(value) >= 1e5 ? Math.round(value) : Number(value.toPrecision(6))
}

function packColumn(values: Array<unknown>): RWAPackedPerpsColumn | null {
	if (values.every((value) => value == null)) return null
	if (values.every((value) => value == null || typeof value === 'number')) {
		return values.map((value) => (value == null ? null : roundForPayload(value as number)))
	}
	const dict: Array<unknown> = []
	const slots = new Map<string, number>()
	const idx = values.map((value) => {
		if (value == null) return -1
		const key = JSON.stringify(value)
		let slot = slots.get(key)
		if (slot == null) {
			slot = dict.length
			slots.set(key, slot)
			dict.push(value)
		}
		return slot
	})
	// A dictionary pays off only when values repeat; contracts stay plain.
	return dict.length * 2 <= values.length ? { dict, idx } : values
}

function readColumn(column: RWAPackedPerpsColumn | undefined, index: number): unknown {
	if (column == null) return null
	if (Array.isArray(column)) return column[index] ?? null
	const slot = column.idx[index]
	return slot == null || slot < 0 ? null : column.dict[slot]
}

function readRowField(row: RWAPerpsContractOverlayRow, key: string): unknown {
	// The id and the ticker are the contract on every market today; keep them only where they differ.
	if (key === 'id' || key === 'ticker') return row[key] === row.contract ? null : row[key]
	return (row as unknown as Record<string, unknown>)[key]
}

export function packRwaPerpsMarkets(rows: ReadonlyArray<RWAPerpsContractOverlayRow>): RWAPackedPerpsMarkets {
	const columns: Record<string, RWAPackedPerpsColumn> = {}
	for (const key of ROW_KEYS) {
		if (DERIVED_KEYS.has(key)) continue
		const column = packColumn(rows.map((row) => readRowField(row, key) ?? null))
		if (column) columns[key] = column
	}
	return { count: rows.length, columns }
}

export function unpackRwaPerpsMarkets(packed: RWAPackedPerpsMarkets): Array<RWAPerpsContractOverlayRow> {
	const rows: Array<RWAPerpsContractOverlayRow> = []
	for (let index = 0; index < packed.count; index++) {
		const row: Record<string, unknown> = {}
		for (const key of ROW_KEYS) row[key] = readColumn(packed.columns[key], index)
		const contract = row.contract as string
		row.id = row.id ?? contract
		row.kind = 'perps'
		row.detailHref = `/rwa/perps/contract/${encodeURIComponent(contract)}`
		row.ticker = row.ticker ?? contract
		row.type = 'Perp'
		row.trueRWA = false
		row.suspicious = row.suspicious === true
		rows.push(row as unknown as RWAPerpsContractOverlayRow)
	}
	return rows
}
