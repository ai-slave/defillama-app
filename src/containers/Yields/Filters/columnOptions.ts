import type { SelectOption } from '~/components/Select/types'

export const EARN_COLUMN_DEFS = {
	volumeUsd1d: { key: 'volumeUsd1d', name: '1d Volume' },
	pricePerShare: { key: 'pricePerShare', name: 'Price per Share' },
	category: { key: 'category', name: 'Category' },
	apyBase: { key: 'apyBase', name: 'APY Base' },
	apyReward: { key: 'apyReward', name: 'APY Reward' },
	apyMean30d: { key: 'apyMean30d', name: '30d Avg APY' },
	top10Pct: { key: 'top10Pct', name: 'Holders: Top 10 %' },
	avgPositionUsd: { key: 'avgPositionUsd', name: 'Holders: Avg Position' },
	// Default only for the measured tier (see PAID_DEFAULT_EARN_COLUMNS): public rows carry no exit
	// outcome, so for everyone else the column would be blank and does not earn a default slot.
	exitStatus: { key: 'exitStatus', name: 'Exit Status' }
} as const satisfies Record<string, { key: string; name: string }>

type EarnColumnId = keyof typeof EARN_COLUMN_DEFS

export const EARN_COLUMN_IDS: Array<EarnColumnId> = [
	'category',
	'exitStatus',
	'apyBase',
	'apyReward',
	'apyMean30d',
	'volumeUsd1d',
	'pricePerShare',
	'top10Pct',
	'avgPositionUsd'
]

export const EARN_COLUMN_OPTIONS: Array<SelectOption> = EARN_COLUMN_IDS.map((id) => ({
	key: EARN_COLUMN_DEFS[id].key,
	name: EARN_COLUMN_DEFS[id].name
}))

export const EARN_COLUMN_OPTION_KEYS = new Set(EARN_COLUMN_OPTIONS.map((option) => option.key))

/** Explicit "no optional columns", so a reader whose default set is non-empty can still clear it. */
export const EARN_NO_COLUMNS = 'none'

/** Only measured-tier rows carry an exit outcome, so only that tier gets the column by default. */
export const PAID_DEFAULT_EARN_COLUMNS: ReadonlyArray<string> = [EARN_COLUMN_DEFS.exitStatus.key]
export const NO_DEFAULT_EARN_COLUMNS: ReadonlyArray<string> = []

/**
 * Keep the server-selected paid tier through the client entitlement handshake. A confirmed denial
 * always wins, while a confirmed grant does not depend on how the page was seeded. The Verified
 * filter also brings the paid defaults: every row it shows is measured, so for a reader without
 * access the column fills with locks instead of the blanks it would show on the full table.
 */
export function resolveEarnColumnAccess({
	hasAccess,
	initialVerifiedAccess,
	isDenied,
	verifiedFilter = false
}: {
	hasAccess: boolean
	initialVerifiedAccess: boolean
	isDenied: boolean
	verifiedFilter?: boolean
}): { verifiedAccess: boolean; defaultColumns: ReadonlyArray<string> } {
	const verifiedAccess = hasAccess || (initialVerifiedAccess && !isDenied)
	return {
		verifiedAccess,
		defaultColumns: verifiedAccess || verifiedFilter ? PAID_DEFAULT_EARN_COLUMNS : NO_DEFAULT_EARN_COLUMNS
	}
}

/**
 * The optional columns in view. An absent `column` param, or one naming none of ours, means the
 * reader's defaults; `none` means they cleared them; anything else is exactly what it names.
 */
export function parseSelectedEarnColumns(
	column: string | Array<string> | undefined,
	defaults: ReadonlyArray<string> = []
): Array<string> {
	const selectedSet = Array.isArray(column) ? new Set(column) : typeof column === 'string' ? new Set([column]) : null
	if (!selectedSet) return [...defaults]
	const selected: Array<string> = []
	for (const id of EARN_COLUMN_IDS) {
		if (selectedSet.has(EARN_COLUMN_DEFS[id].key)) selected.push(EARN_COLUMN_DEFS[id].key)
	}
	if (selected.length === 0 && !selectedSet.has(EARN_NO_COLUMNS)) return [...defaults]
	return selected
}
