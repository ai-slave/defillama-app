import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { buildPairColumns, formatPairPrice, pairDepthTotal } from '../PairTable'

describe('formatPairPrice', () => {
	test('keeps raw pair prices in their quote asset instead of presenting them as USD', () => {
		expect(formatPairPrice(1.25, 'eur')).toBe('1.25 EUR')
		expect(formatPairPrice(null, 'usdt')).toBe('–')
	})
})

describe('pair depth totals', () => {
	test('preserves missing, one-sided observed, and observed-zero depth', () => {
		expect(pairDepthTotal(null, null)).toBeNull()
		expect(pairDepthTotal(25, null)).toBe(25)
		expect(pairDepthTotal(null, 0)).toBe(0)
		expect(pairDepthTotal(0, 0)).toBe(0)
	})
})

describe('pair presentation', () => {
	test('includes perp leverage and makes it available as a separate CSV field', () => {
		const columns = buildPairColumns('linear_perp', { openInterest: true, funding: true, depth: true }, false)
		const pairColumn = columns.find((column) => column.id === 'pair')!
		if (typeof pairColumn.cell !== 'function') throw new Error('Expected the pair column to define a cell renderer')

		const html = renderToStaticMarkup(
			pairColumn.cell({
				getValue: () => 'btc/usdt',
				row: { original: { pairUrl: 'https://example.com/btc-usdt', maxLeverage: 100 } }
			} as never)
		)

		expect(html).toContain('href="https://example.com/btc-usdt"')
		expect(html).toContain('100×')
		expect(columns.find((column) => column.id === 'maxLeverage')?.meta).toMatchObject({
			hidden: true,
			csvOnly: true
		})
	})

	test('does not render leverage beside a spot pair', () => {
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

		expect(html).toContain('href="https://example.com/btc-usdt"')
		expect(html).not.toContain('100×')
	})
})
