import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { perpsAsset } from '../../../table/__tests__/fixtures'
import { summarizeRwaVenueMarkets } from '../../venueData'
import { VenueMarketsPanel } from '../VenueMarkets'

function maxLeverageText(leverages: Array<number>): string {
	const summary = summarizeRwaVenueMarkets(leverages.map((maxLeverage, i) => perpsAsset({ id: `m${i}`, maxLeverage })))
	const text = renderToStaticMarkup(<VenueMarketsPanel summary={summary} />)
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
	return text.match(/Max leverage (.+?x(?: to .+?x)?) /)?.[1] ?? ''
}

test('formats the max leverage range as the table cell does', () => {
	expect(maxLeverageText([3.0003000300030003, 50])).toBe('3x to 50x')
})

test('reads one value when both ends of the range format the same', () => {
	expect(maxLeverageText([3, 3.0003000300030003])).toBe('3x')
})
