import type { SelectOption, SelectValues } from '~/ui/Select'
import { formatNumber } from '~/utils/numberFormat'
import type { RWAOverviewDisplayRow } from './api.types'
import { getRwaRowFilterValues, type RWASelectFilterKey } from './filterState'
import { RWA_INCLUSION_OPTIONS, type RWAInclusionKey } from './inclusion'
import { RWA_WRAPPER_TYPE } from './wrappers'

/** The options of an inline picker with each option's row count beside its name, as a tick's effect reads first. */
export function withRwaOptionCounts(values: SelectValues, counts: Record<string, number>): Array<SelectOption> {
	return values.map((value) => {
		const option = typeof value === 'string' ? { key: value, name: value } : value
		return { ...option, name: `${option.name} (${formatNumber(counts[option.key] ?? 0)})` }
	})
}

/**
 * A Perps picker's options: each value counts the markets Venue Type keeps, and a value Venue Type leaves out stays
 * listed, grayed (`muted`), with the choice that brings it back, as the Assets pickers do for Include in TVL.
 */
export function getRwaPerpsPickerOptions(values: Array<string>, counts: Record<string, number>): Array<SelectOption> {
	return withRwaOptionCounts(values, counts).map((option) =>
		counts[option.key]
			? option
			: { ...option, muted: true, help: 'Left out by Venue Type: choose DEX and CEX to count these markets.' }
	)
}

type RWAInclusionState = Record<Exclude<RWAInclusionKey, 'includeBridgeTvl'>, boolean>

/** The Include in TVL toggles that leave the row out, by their labels. */
function getHidingToggles(row: RWAOverviewDisplayRow, inclusion: RWAInclusionState): Array<string> {
	const hiding = new Set<RWAInclusionKey>()
	if (row.kind === 'spot' && row.stablecoin && !inclusion.includeStablecoins) hiding.add('includeStablecoins')
	if (row.kind === 'spot' && row.governance && !inclusion.includeGovernance) hiding.add('includeGovernance')
	if (row.type === RWA_WRAPPER_TYPE && !inclusion.includeWrappers) hiding.add('includeWrappers')
	return RWA_INCLUSION_OPTIONS.filter((option) => hiding.has(option.key)).map((option) => option.name)
}

/**
 * An Assets inline picker's options: each value counts the page's rows Include in TVL keeps, and a value whose rows
 * the toggles all leave out stays listed, grayed (`muted`), with the toggle that brings it back.
 */
export function getRwaAssetsInlineOptions(
	key: RWASelectFilterKey,
	values: SelectValues,
	rows: ReadonlyArray<RWAOverviewDisplayRow>,
	inclusion: RWAInclusionState
): Array<SelectOption> {
	const counts: Record<string, number> = {}
	const hiddenBy = new Map<string, Set<string>>()
	for (const row of rows) {
		const hiding = getHidingToggles(row, inclusion)
		for (const value of getRwaRowFilterValues(row, key)) {
			if (hiding.length === 0) {
				counts[value] = (counts[value] ?? 0) + 1
			} else {
				const toggles = hiddenBy.get(value) ?? new Set<string>()
				for (const toggle of hiding) toggles.add(toggle)
				hiddenBy.set(value, toggles)
			}
		}
	}
	return withRwaOptionCounts(values, counts).map((option) => {
		const toggles = hiddenBy.get(option.key)
		if (counts[option.key] || !toggles) return option
		const hint = `Left out by Include in TVL: turn on ${[...toggles].join(' or ')} to count these assets.`
		return { ...option, muted: true, help: option.help ? `${hint} ${option.help}` : hint }
	})
}
