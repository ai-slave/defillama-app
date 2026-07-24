import { describe, expect, it } from 'vitest'
import type { LiquidationPosition } from '../api.types'
import { createLiquidationPositionSearchIndex, filterLiquidationPositions } from '../Table'

const position: LiquidationPosition = {
	protocolId: 'aave',
	protocolName: 'Aave',
	protocolSlug: 'aave',
	chainId: 'ethereum',
	chainName: 'Ethereum',
	chainSlug: 'ethereum',
	owner: '0x1234567890abcdef',
	ownerName: 'Treasury Wallet',
	ownerUrlOverride: 'https://example.com/owner',
	liqPrice: 1234,
	collateral: 'WBTC',
	collateralAmount: 1.25,
	collateralAmountUsd: 110000
}

describe('filterLiquidationPositions', () => {
	const searchIndex = createLiquidationPositionSearchIndex([position])

	it('matches protocol, chain, owner, token, and raw owner fields', () => {
		expect(filterLiquidationPositions([position], searchIndex, 'aave')).toEqual([position])
		expect(filterLiquidationPositions([position], searchIndex, 'ethereum')).toEqual([position])
		expect(filterLiquidationPositions([position], searchIndex, 'treasury')).toEqual([position])
		expect(filterLiquidationPositions([position], searchIndex, 'wbtc')).toEqual([position])
		expect(filterLiquidationPositions([position], searchIndex, '0x123456')).toEqual([position])
	})

	it('returns an empty list when no searchable fields match', () => {
		expect(filterLiquidationPositions([position], searchIndex, 'solana')).toEqual([])
	})

	it('normalizes whitespace, case, and diacritics', () => {
		const accentedPosition = { ...position, protocolName: 'Morphó' }
		const accentedIndex = createLiquidationPositionSearchIndex([accentedPosition])
		expect(filterLiquidationPositions([accentedPosition], accentedIndex, '  MORPHO  ')).toEqual([accentedPosition])
	})

	it('preserves input order because the table applies its own value sort', () => {
		const secondPosition = { ...position, owner: '0xabcdef', ownerName: 'Aave Treasury' }
		const rows = [position, secondPosition]
		expect(filterLiquidationPositions(rows, createLiquidationPositionSearchIndex(rows), 'aave')).toEqual(rows)
	})
})
