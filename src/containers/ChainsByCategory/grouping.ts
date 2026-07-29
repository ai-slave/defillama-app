import { mergeChainAssetTotals } from './chainAssetTotals'
import type { IFormattedDataWithExtraTvlBase } from './types'

export interface GroupableChain {
	name: string
	childGroups: Record<string, string[]> | null
}

/** Resolve selected child membership before emitting rows so input sort order cannot duplicate a child. */
export function getTopLevelGroupedChains<T extends GroupableChain>(
	chains: readonly T[],
	selectedGroups: readonly string[]
): T[] {
	const childNames = new Set<string>()
	for (const chain of chains) {
		for (const group of selectedGroups) {
			for (const child of chain.childGroups?.[group] ?? []) childNames.add(child)
		}
	}
	return chains.filter((chain) => !childNames.has(chain.name))
}

const EXACT_GROUPED_NUMBER_FIELDS = [
	'tvl',
	'tvlPrevDay',
	'tvlPrevWeek',
	'tvlPrevMonth',
	'mcap',
	'stablesMcap',
	'activeUsers24h',
	'activeUsers7d',
	'activeUsers30d',
	'dexVolume24h',
	'dexVolume7d',
	'dexVolume30d',
	'fees24h',
	'fees7d',
	'fees30d',
	'revenue24h',
	'revenue7d',
	'revenue30d',
	'appRevenue24h',
	'appRevenue7d',
	'appRevenue30d',
	'nftVolume24h',
	'nftVolume7d',
	'nftVolume30d'
] as const satisfies ReadonlyArray<keyof IFormattedDataWithExtraTvlBase>

type ExactGroupedNumberField = (typeof EXACT_GROUPED_NUMBER_FIELDS)[number]
export type GroupedChainTotals = Pick<IFormattedDataWithExtraTvlBase, ExactGroupedNumberField | 'protocols'> & {
	chainAssets: Exclude<IFormattedDataWithExtraTvlBase['chainAssets'], undefined>
}

function sumGroupedField(
	rows: readonly IFormattedDataWithExtraTvlBase[],
	field: ExactGroupedNumberField
): number | null {
	let total = 0
	for (const row of rows) {
		const value = row[field]
		if (value == null) return null
		total += value
	}
	return total
}

export function aggregateGroupedChainRows(rows: readonly IFormattedDataWithExtraTvlBase[]): GroupedChainTotals {
	let chainAssets = rows[0]?.chainAssets ?? null
	for (let index = 1; index < rows.length; index++) {
		chainAssets = mergeChainAssetTotals(chainAssets, rows[index]?.chainAssets ?? null)
	}

	return {
		tvl: sumGroupedField(rows, 'tvl'),
		tvlPrevDay: sumGroupedField(rows, 'tvlPrevDay'),
		tvlPrevWeek: sumGroupedField(rows, 'tvlPrevWeek'),
		tvlPrevMonth: sumGroupedField(rows, 'tvlPrevMonth'),
		// Producer counts are per chain; summing would double-count multichain protocols.
		protocols: null,
		mcap: sumGroupedField(rows, 'mcap'),
		stablesMcap: sumGroupedField(rows, 'stablesMcap'),
		activeUsers24h: sumGroupedField(rows, 'activeUsers24h'),
		activeUsers7d: sumGroupedField(rows, 'activeUsers7d'),
		activeUsers30d: sumGroupedField(rows, 'activeUsers30d'),
		dexVolume24h: sumGroupedField(rows, 'dexVolume24h'),
		dexVolume7d: sumGroupedField(rows, 'dexVolume7d'),
		dexVolume30d: sumGroupedField(rows, 'dexVolume30d'),
		fees24h: sumGroupedField(rows, 'fees24h'),
		fees7d: sumGroupedField(rows, 'fees7d'),
		fees30d: sumGroupedField(rows, 'fees30d'),
		revenue24h: sumGroupedField(rows, 'revenue24h'),
		revenue7d: sumGroupedField(rows, 'revenue7d'),
		revenue30d: sumGroupedField(rows, 'revenue30d'),
		appRevenue24h: sumGroupedField(rows, 'appRevenue24h'),
		appRevenue7d: sumGroupedField(rows, 'appRevenue7d'),
		appRevenue30d: sumGroupedField(rows, 'appRevenue30d'),
		nftVolume24h: sumGroupedField(rows, 'nftVolume24h'),
		nftVolume7d: sumGroupedField(rows, 'nftVolume7d'),
		nftVolume30d: sumGroupedField(rows, 'nftVolume30d'),
		chainAssets
	}
}
