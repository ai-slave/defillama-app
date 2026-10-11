import { describe, expect, test } from 'vitest'
import { getRwaAssetsInlineOptions, getRwaPerpsPickerOptions, withRwaOptionCounts } from '../inlineOptions'
import { spotAsset } from '../table/__tests__/fixtures'

describe('withRwaOptionCounts', () => {
	test('names each option with how many rows it holds, keeping its help', () => {
		expect(
			withRwaOptionCounts(
				[
					{ key: 'Debt', name: 'Debt', help: 'Loans' },
					{ key: 'Fund', name: 'Fund' }
				],
				{ Debt: 1200, Fund: 0 }
			)
		).toEqual([
			{ key: 'Debt', name: 'Debt (1,200)', help: 'Loans' },
			{ key: 'Fund', name: 'Fund (0)' }
		])
	})
})

describe('getRwaPerpsPickerOptions', () => {
	test('grays a value Venue Type leaves out and keeps it selectable with a hint', () => {
		const [binance, xyz] = getRwaPerpsPickerOptions(['Binance', 'trade[XYZ]'], { 'trade[XYZ]': 2 })
		expect(binance).toMatchObject({ key: 'Binance', name: 'Binance (0)', muted: true })
		expect(binance.help).toBeTypeOf('string')
		expect(xyz).toEqual({ key: 'trade[XYZ]', name: 'trade[XYZ] (2)' })
	})
})

describe('getRwaAssetsInlineOptions', () => {
	const rows = [
		spotAsset({ id: 'a', category: ['Treasuries'] }),
		spotAsset({ id: 'b', category: ['Treasuries', 'Fiat Stablecoins'], stablecoin: true }),
		spotAsset({ id: 'c', category: ['Governance Tokens'], governance: true }),
		spotAsset({ id: 'd', category: ['Fiat Stablecoins'], stablecoin: true })
	]
	const values = [
		{ key: 'Treasuries', name: 'Treasuries' },
		{ key: 'Fiat Stablecoins', name: 'Fiat Stablecoins' },
		{ key: 'Governance Tokens', name: 'Governance Tokens' }
	]
	const inclusion = { includeStablecoins: false, includeGovernance: false, includeWrappers: false }

	test('counts the rows Include in TVL keeps and grays out a category it hides, naming the toggle', () => {
		expect(getRwaAssetsInlineOptions('categories', values, rows, inclusion)).toEqual([
			{ key: 'Treasuries', name: 'Treasuries (1)' },
			{
				key: 'Fiat Stablecoins',
				name: 'Fiat Stablecoins (0)',
				muted: true,
				help: 'Left out by Include in TVL: turn on Stablecoins to count these assets.'
			},
			{
				key: 'Governance Tokens',
				name: 'Governance Tokens (0)',
				muted: true,
				help: 'Left out by Include in TVL: turn on Governance Tokens to count these assets.'
			}
		])
	})

	test('a category comes back once its toggle is on', () => {
		const options = getRwaAssetsInlineOptions('categories', values, rows, { ...inclusion, includeStablecoins: true })
		expect(options[1]).toEqual({ key: 'Fiat Stablecoins', name: 'Fiat Stablecoins (2)' })
	})
})
