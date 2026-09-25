import type { KpkRef, KpkVault } from './api'
import { vaultTotals } from './transform'
import { andList, usdCompact, type FooterRow } from './ui'

export const ALL_VENUES = 'all'

const SYMBIOTIC_REF: KpkRef = { label: 'Symbiotic vaults', url: 'https://dune.com/kpk/kpk-usdc-rwa-liquidity' }

/** Served copy may drop its closing stop; the legal line follows it as a new sentence. */
export function endSentence(text: string) {
	const trimmed = text.trim()
	return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/** The adapter serves no Symbiotic query yet, so it is appended until it does. */
export function vaultRefs(served: Array<KpkRef> | undefined): Array<KpkRef> | undefined {
	if (!served) return undefined
	return served.some((ref) => ref.url === SYMBIOTIC_REF.url) ? served : [...served, SYMBIOTIC_REF]
}

export function vaultsOnVenue(list: Array<KpkVault>, venue: string): Array<KpkVault> {
	return venue === ALL_VENUES ? list : list.filter((vault) => vault.venue === venue)
}

/** Venues holding a vault that another vault on the table already counts, in list order. */
export function doubleCountedVenues(list: ReadonlyArray<KpkVault>): Array<string> {
	const venues = new Set<string>()
	for (const vault of list) if (vault.doubleCounted) venues.add(vault.venue)
	return [...venues]
}

/** A gross total, plus an adjusted one only when the rows on screen double count something. */
export function vaultFooterRows(rows: ReadonlyArray<KpkVault>, doubleCountNote: string): Array<FooterRow> {
	const totals = vaultTotals(rows)
	const footer: Array<FooterRow> = [
		{ cells: { name: 'Total', tva: usdCompact(totals.tvaUsd), interest: usdCompact(totals.interestUsd) } }
	]
	if (totals.duplicateVenues.length > 0) {
		footer.push({
			muted: true,
			title: doubleCountNote,
			cells: {
				name: `Adjusted, excl. ${andList(totals.duplicateVenues)}`,
				tva: usdCompact(totals.tvaAdjustedUsd),
				interest: usdCompact(totals.interestAdjustedUsd)
			}
		})
	}
	return footer
}
