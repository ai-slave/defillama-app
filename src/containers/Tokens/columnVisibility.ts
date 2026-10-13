import { functionalUpdate, type ColumnVisibilityState, type Updater } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { setStorageJSON, useStorageItem } from '~/contexts/localStorageStore'
import { TOKENS_HIDEABLE_COLUMN_SPECS } from './columnSpecs'

const TOKENS_COLUMN_VISIBILITY_STORAGE_KEY = 'tokens-table-column-visibility-v2'

const DEFAULT_VISIBLE_COLUMN_IDS = new Set([
	'price',
	'priceChange24h',
	'priceChange7d',
	'priceChange30d',
	'marketCap',
	'fdv',
	'spotVolume24h',
	'perpsVolume24h',
	'revenue24h'
])

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibilityState = Object.fromEntries(
	TOKENS_HIDEABLE_COLUMN_SPECS.map((column) => [column.id, DEFAULT_VISIBLE_COLUMN_IDS.has(column.id)])
)

// Stored by an older build or edited by hand, the value may not be JSON or not an object.
export function parseStoredColumnVisibility(stored: string | null): ColumnVisibilityState | null {
	try {
		const parsed = stored ? JSON.parse(stored) : null
		return parsed && typeof parsed === 'object' ? parsed : null
	} catch {
		return null
	}
}

/**
 * The Tokens table's column choice, remembered across visits and tabs. The server and the hydrating render read no
 * storage, so both draw the default columns.
 */
export function useTokensColumnVisibility(): [
	ColumnVisibilityState,
	(updater: Updater<ColumnVisibilityState>) => void
] {
	const stored = useStorageItem(TOKENS_COLUMN_VISIBILITY_STORAGE_KEY, null)
	// The columns the reader picked on this visit. They win over storage, so the picker still works where storage is
	// blocked and the write is dropped.
	const [chosen, setChosen] = useState<ColumnVisibilityState | null>(null)
	const storedVisibility = useMemo(() => parseStoredColumnVisibility(stored), [stored])
	const columnVisibility = chosen ?? storedVisibility ?? DEFAULT_COLUMN_VISIBILITY
	const setColumnVisibility = (updater: Updater<ColumnVisibilityState>) => {
		const next = functionalUpdate(updater, columnVisibility)
		setChosen(next)
		setStorageJSON(TOKENS_COLUMN_VISIBILITY_STORAGE_KEY, next)
	}
	return [columnVisibility, setColumnVisibility]
}
