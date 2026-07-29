import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildPairColumns, formatPairPrice, pairDepthTotal } from '../PairTable'

describe('formatPairPrice', () => {
	it('keeps raw pair prices in their quote asset instead of presenting them as USD', () => {
		expect(formatPairPrice(1.25, 'eur')).toBe('1.25 EUR')
		expect(formatPairPrice(null, 'usdt')).toBe('–')
	})
})

describe('pair depth totals', () => {
	it('preserves missing, one-sided observed, and observed-zero depth', () => {
		expect(pairDepthTotal(null, null)).toBeNull()
		expect(pairDepthTotal(25, null)).toBe(25)
		expect(pairDepthTotal(null, 0)).toBe(0)
		expect(pairDepthTotal(0, 0)).toBe(0)
	})
})

describe('pair presentation', () => {
	it('renders perp leverage after the pair link and keeps its standalone column CSV-only', () => {
		const columns = buildPairColumns('linear_perp', { openInterest: true, funding: true, depth: true }, false)
		const pairColumn = columns.find((column) => column.id === 'pair')!
		if (typeof pairColumn.cell !== 'function') throw new Error('Expected the pair column to define a cell renderer')

		const html = renderToStaticMarkup(
			pairColumn.cell({
				getValue: () => 'btc/usdt',
				row: { original: { pairUrl: 'https://example.com/btc-usdt', maxLeverage: 100 } }
			} as never)
		)
		const linkEnd = html.indexOf('</a>')
		const leverage = html.indexOf('100×')

		expect(html).toContain('href="https://example.com/btc-usdt"')
		expect(linkEnd).toBeGreaterThan(-1)
		expect(leverage).toBeGreaterThan(linkEnd)
		expect(columns.find((column) => column.id === 'maxLeverage')?.meta).toMatchObject({
			hidden: true,
			csvOnly: true
		})
	})

	it('does not render leverage beside a spot pair', () => {
		const pairColumn = buildPairColumns('spot', { openInterest: false, funding: false, depth: true }, false).find(
			(column) => column.id === 'pair'
		)!
		if (typeof pairColumn.cell !== 'function') throw new Error('Expected the pair column to define a cell renderer')

		const html = renderToStaticMarkup(
			pairColumn.cell({
				getValue: () => 'btc/usdt',
				row: { original: { pairUrl: 'https://example.com/btc-usdt', maxLeverage: 100 } }
			} as never)
		)

		expect(html).not.toContain('100×')
	})
})
