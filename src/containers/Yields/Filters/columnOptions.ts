import type { SelectOption } from '~/components/Select/types'

export const EARN_COLUMN_DEFS = {
	volumeUsd1d: { key: 'volumeUsd1d', name: '1d Volume' },
	pricePerShare: { key: 'pricePerShare', name: 'Price per Share' },
	category: { key: 'category', name: 'Category' },
	apyBase: { key: 'apyBase', name: 'APY Base' },
	apyReward: { key: 'apyReward', name: 'APY Reward' },
	apyMean30d: { key: 'apyMean30d', name: '30d Avg APY' },
	top10Pct: { key: 'top10Pct', name: 'Holders: Top 10 %' },
	avgPositionUsd: { key: 'avgPositionUsd', name: 'Holders: Avg Position' }
} as const satisfies Record<string, { key: string; name: string }>

type EarnColumnId = keyof typeof EARN_COLUMN_DEFS

export const EARN_COLUMN_IDS: Array<EarnColumnId> = [
	'category',
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

export function parseSelectedEarnColumns(column: string | Array<string> | undefined): Array<string> {
	const selectedSet = Array.isArray(column) ? new Set(column) : typeof column === 'string' ? new Set([column]) : null
	if (!selectedSet) return []
	const selected: Array<string> = []
	for (const id of EARN_COLUMN_IDS) {
		if (selectedSet.has(EARN_COLUMN_DEFS[id].key)) selected.push(EARN_COLUMN_DEFS[id].key)
	}
	return selected
}
