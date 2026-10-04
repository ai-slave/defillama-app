import { removedCategoriesFromChainTvlSet } from './constants'
import type { IChildProtocol, IProtocol } from './types'

/**
 * Display policy for the TVL strike marker. `strikeTvl` is baked into the snapshot as "this protocol
 * HAS a doublecounted or liquidstaking section (or a removed category)", but
 * whether that section is actually subtracted from chain TVL depends on the
 * reader's "Include in TVL" toggles. A section the reader opted back in is
 * not subtracted, so it must not be struck or annotated.
 *
 * The toggles never change the row's own TVL number — doublecounted and
 * liquidstaking are markers for chain aggregation, not addable amounts
 * (see isAdditiveTvlKey in ProtocolLists/utils).
 */

const WHITE_LABELED_VAULT_PROVIDERS = new Set(['Veda'])

type StrikeToggles = { doublecounted?: boolean; liquidstaking?: boolean }

type ActiveReasons = { doublecounted: boolean; liquidstaking: boolean; removedCategory: boolean }

function activeReasons(row: IChildProtocol, toggles: StrikeToggles): ActiveReasons {
	if (!row.strikeTvl) return { doublecounted: false, liquidstaking: false, removedCategory: false }
	return {
		removedCategory: !!row.category && removedCategoriesFromChainTvlSet.has(row.category),
		doublecounted: row.tvl?.doublecounted !== undefined && !toggles.doublecounted,
		liquidstaking: row.tvl?.liquidstaking !== undefined && !toggles.liquidstaking
	}
}

function isActive(reasons: ActiveReasons): boolean {
	return reasons.removedCategory || reasons.doublecounted || reasons.liquidstaking
}

export function getProtocolTvlStrike(
	rowValues: IProtocol,
	toggles: StrikeToggles
): { struck: boolean; text: string | null } {
	if (!rowValues.strikeTvl) return { struck: false, text: null }

	const own = activeReasons(rowValues, toggles)
	// A parent's strikeTvl is derived from its children; its own tvl record may
	// carry no sections, so the children decide whether the strike is active.
	const childActive = rowValues.childProtocols?.some((child) => isActive(activeReasons(child, toggles))) ?? false

	if (!isActive(own) && !childActive) return { struck: false, text: null }

	if (own.removedCategory) {
		return { struck: true, text: `${rowValues.category} protocols are not counted into Chain TVL` }
	}
	if (rowValues.childProtocols) {
		return { struck: true, text: 'Some sub-protocols are excluded from chain tvl' }
	}
	if (WHITE_LABELED_VAULT_PROVIDERS.has(rowValues.name)) {
		return {
			struck: true,
			text: 'This protocol issues white-labeled vaults which may result in TVL being counted by another protocol (e.g., double counted).'
		}
	}
	if (own.doublecounted && own.liquidstaking) {
		return {
			struck: true,
			text: 'This protocol deposits into another protocol or is under Liquid Staking category, so it is subtracted from total TVL because both "Liquid Staking" and "Double Count" toggles are off'
		}
	}
	if (own.liquidstaking) {
		return {
			struck: true,
			text: 'This protocol is under Liquid Staking category and is subtracted from total TVL because "Liquid Staking" toggle is off'
		}
	}
	return {
		struck: true,
		text: 'This protocol deposits into another protocol and is subtracted from total TVL because "Double Count" toggle is off'
	}
}
