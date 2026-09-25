import { describe, expect, test } from 'vitest'
import type { KpkVault } from '../api'
import { ALL_VENUES, doubleCountedVenues, endSentence, vaultFooterRows, vaultRefs, vaultsOnVenue } from '../vaultsModel'

const vault = (name: string, venue: string, tva: number, interest: number, doubleCounted?: boolean): KpkVault => ({
	name,
	venue,
	chain: 'Ethereum',
	asset: 'USDC',
	tva,
	interest,
	liqTarget: 15,
	apy: 4,
	apy30: 4,
	rebalances30d: 1,
	liq: 50,
	spreadBps: 10,
	belowTarget: false,
	...(doubleCounted ? { doubleCounted } : {})
})

const LIST = [
	vault('Prime', 'Morpho', 20, 0.5),
	vault('Earn', 'Gearbox', 10, 0.25),
	vault('RWA', 'Symbiotic', 1, 0.002, true)
]

const SYMBIOTIC = { label: 'Symbiotic vaults', url: 'https://dune.com/kpk/kpk-usdc-rwa-liquidity' }
const MORPHO = { label: 'Morpho vaults', url: 'https://dune.com/kpk/kpk-morpho-vaults' }

describe('vaultFooterRows', () => {
	test('totals the rows in USD and nets the double-counted vault out of a second row', () => {
		expect(vaultFooterRows(LIST, 'note')).toEqual([
			{ cells: { name: 'Total', tva: '$31m', interest: '$752k' } },
			{ muted: true, title: 'note', cells: { name: 'Adjusted, excl. Symbiotic', tva: '$30m', interest: '$750k' } }
		])
	})

	test('drops the adjusted row when the rows on screen double count nothing', () => {
		expect(vaultFooterRows(vaultsOnVenue(LIST, 'Gearbox'), 'note')).toEqual([
			{ cells: { name: 'Total', tva: '$10m', interest: '$250k' } }
		])
	})
})

describe('vaultsOnVenue', () => {
	test('keeps every vault for the all filter and only the venue otherwise', () => {
		expect(vaultsOnVenue(LIST, ALL_VENUES).map((row) => row.name)).toEqual(['Prime', 'Earn', 'RWA'])
		expect(vaultsOnVenue(LIST, 'Morpho').map((row) => row.name)).toEqual(['Prime'])
	})
})

describe('doubleCountedVenues', () => {
	test('names each venue holding a double-counted vault once', () => {
		expect(doubleCountedVenues([...LIST, vault('RWA 2', 'Symbiotic', 1, 0, true)])).toEqual(['Symbiotic'])
		expect(doubleCountedVenues(LIST.slice(0, 2))).toEqual([])
	})
})

describe('vaultRefs', () => {
	test('appends the Symbiotic query until the adapter serves it', () => {
		expect(vaultRefs([MORPHO])).toEqual([MORPHO, SYMBIOTIC])
		expect(vaultRefs([SYMBIOTIC, MORPHO])).toEqual([SYMBIOTIC, MORPHO])
		expect(vaultRefs(undefined)).toBeUndefined()
	})
})

describe('endSentence', () => {
	test('closes served copy with a stop only when it lacks one', () => {
		expect(endSentence(' Curated vaults carry risk of loss ')).toBe('Curated vaults carry risk of loss.')
		expect(endSentence('Really?')).toBe('Really?')
	})
})
