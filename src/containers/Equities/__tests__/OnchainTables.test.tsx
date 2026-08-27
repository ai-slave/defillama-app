// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EquitiesMarketsTable, EquitiesTokensTable } from '../OnchainTables'
import type { IEquitiesOnchainMarketRow, IEquitiesOnchainTokenRow } from '../types'

vi.mock('~/components/CsvDownloadButton', () => ({ CSVDownloadButton: () => null }))
vi.mock('~/components/Link', () => ({
	BasicLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>
}))

const markets: IEquitiesOnchainMarketRow[] = [100, null, 0, 10].map((value, index) => ({
	pair: `market-${index}`,
	contractSlug: `contract-${index}`,
	price: value,
	volume24h: value,
	openInterest: value,
	annualizedFundingRate: value === 10 ? -10 : value,
	tradeUrl: 'https://example.com',
	exchangeType: 'DEX',
	exchangeName: null,
	platformName: null,
	updatedAt: '2026-08-27T00:00:00Z'
}))

const tokens: IEquitiesOnchainTokenRow[] = [100, null, 0, 10].map((value, index) => ({
	assetSlug: `token-${index}`,
	issuer: 'Issuer',
	issuerRwaPlatformSlug: 'issuer',
	issuerRwaPlatformName: 'Issuer',
	price: value,
	activeMarketcap: value
}))

describe('equities onchain table sorting', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	const rowNames = () => [...container.querySelectorAll('tbody tr')].map((row) => row.children[0].textContent)
	const clickHeader = async (label: string) => {
		const button = [...container.querySelectorAll<HTMLButtonElement>('thead button')].find(
			(button) => button.textContent === label
		)!
		await act(async () => button.click())
	}

	it.each(['24h Volume', 'Price', 'Open Interest', 'Funding APR'])(
		'keeps missing market %s last in both directions, preserving zero and negative values',
		async (header) => {
			await act(async () => root.render(<EquitiesMarketsTable markets={markets} ticker="NVDA" />))
			expect(rowNames()).toEqual(['market-0', 'market-1', 'market-2', 'market-3'])

			await clickHeader(header)
			expect(rowNames()).toEqual(
				header === 'Funding APR'
					? ['market-0', 'market-2', 'market-3', 'market-1']
					: ['market-0', 'market-3', 'market-2', 'market-1']
			)

			await clickHeader(header)
			expect(rowNames()).toEqual(
				header === 'Funding APR'
					? ['market-3', 'market-2', 'market-0', 'market-1']
					: ['market-2', 'market-3', 'market-0', 'market-1']
			)
		}
	)

	it('preserves the supplied default order and lets column sorting override it', async () => {
		const rows: IEquitiesOnchainMarketRow[] = [
			{ ...markets[0], pair: 'Bybit large', rwaPlatformSlug: 'bybit', volume24h: 200 },
			{ ...markets[0], pair: 'Binance', rwaPlatformSlug: 'binance', volume24h: 300 },
			{ ...markets[0], pair: 'Bybit small', rwaPlatformSlug: 'bybit', volume24h: 10 },
			{ ...markets[0], pair: 'Zero', volume24h: 0 },
			{ ...markets[0], pair: 'Ostium', rwaPlatformSlug: 'ostium', volume24h: null }
		]
		const originalOrder = rows.map((row) => row.pair)
		await act(async () => root.render(<EquitiesMarketsTable markets={rows} ticker="NVDA" />))
		expect(rowNames()).toEqual(['Bybit large', 'Binance', 'Bybit small', 'Zero', 'Ostium'])
		expect(container.querySelector('thead svg.text-brand')).toBeNull()
		expect(rows.map((row) => row.pair)).toEqual(originalOrder)

		await clickHeader('24h Volume')
		expect(rowNames()).toEqual(['Binance', 'Bybit large', 'Bybit small', 'Zero', 'Ostium'])
		expect(container.querySelector('thead svg.text-brand')?.getAttribute('data-icon')).toBe('caret-down')

		await clickHeader('24h Volume')
		expect(rowNames()).toEqual(['Zero', 'Bybit small', 'Bybit large', 'Binance', 'Ostium'])

		await clickHeader('24h Volume')
		expect(rowNames()).toEqual(['Bybit large', 'Binance', 'Bybit small', 'Zero', 'Ostium'])
		expect(container.querySelector('thead svg.text-brand')).toBeNull()
	})

	it('paginates the supplied default order and sorts missing values last on demand', async () => {
		const rows: IEquitiesOnchainMarketRow[] = [
			{ ...markets[0], pair: 'Bybit', rwaPlatformSlug: 'bybit', volume24h: null },
			...Array.from({ length: 12 }, (_, index) => ({ ...markets[0], pair: `market-${index}`, volume24h: 100 - index }))
		]
		await act(async () => root.render(<EquitiesMarketsTable markets={rows} ticker="NVDA" />))
		expect(rowNames()).toHaveLength(10)
		expect(rowNames()[0]).toBe('Bybit')

		await clickHeader('24h Volume')
		expect(rowNames()).not.toContain('Bybit')
		await clickHeader('24h Volume')
		expect(rowNames()).not.toContain('Bybit')
	})

	it.each(['Active Market Cap', 'Price'])('keeps missing token %s last in both directions', async (header) => {
		await act(async () => root.render(<EquitiesTokensTable tokens={tokens} ticker="NVDA" />))
		expect(rowNames()).toEqual(['token-0', 'token-3', 'token-2', 'token-1'])

		if (header !== 'Active Market Cap') await clickHeader(header)
		expect(rowNames()).toEqual(['token-0', 'token-3', 'token-2', 'token-1'])

		await clickHeader(header)
		expect(rowNames()).toEqual(['token-2', 'token-3', 'token-0', 'token-1'])
	})
})
