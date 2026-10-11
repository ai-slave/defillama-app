import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { LiquidationPosition } from '../api.types'
import { LiquidationsExplorerProvider, LiquidationsOwnerLink } from '../OwnerLink'

const basePosition: LiquidationPosition = {
	protocolId: 'aave',
	protocolName: 'Aave',
	protocolSlug: 'aave',
	chainId: 'arbitrum',
	chainName: 'Arbitrum One',
	chainSlug: 'arbitrum-one',
	owner: '0x1234567890abcdef1234567890abcdef12345678',
	liqPrice: 1234,
	collateral: 'WBTC',
	collateralId: '0xwbtc',
	collateralAmount: 1.25,
	collateralAmountUsd: 110_000
}

describe('LiquidationsOwnerLink', () => {
	test('derives a block explorer url for supported chains', () => {
		const html = renderToStaticMarkup(
			<LiquidationsExplorerProvider
				blockExplorers={[
					{
						displayName: 'Arbitrum',
						llamaChainId: 'arbitrum',
						evmChainId: 42_161,
						blockExplorers: [{ name: 'Arbiscan', url: 'https://arbiscan.io' }]
					}
				]}
			>
				<LiquidationsOwnerLink position={basePosition} />
			</LiquidationsExplorerProvider>
		)

		expect(html).toContain(`href="https://arbiscan.io/address/${basePosition.owner}"`)
	})

	test('renders plain text when no explorer match exists', () => {
		const html = renderToStaticMarkup(
			<LiquidationsExplorerProvider blockExplorers={[]}>
				<LiquidationsOwnerLink position={basePosition} />
			</LiquidationsExplorerProvider>
		)

		expect(html).toContain('0x123456…345678')
		expect(html).not.toContain('href=')
	})
})
