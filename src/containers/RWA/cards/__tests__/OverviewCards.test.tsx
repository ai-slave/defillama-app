import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { RwaOverviewCards } from '../cardData'
import { RWAOverviewCards } from '../OverviewCards'

const DAY = 24 * 60 * 60 * 1000

const cards: RwaOverviewCards = {
	defiByProtocol: {
		withBridges: {
			value: 3_880_000_000,
			changeUsd: -79_500_000,
			changePct: -2,
			bars: [
				{ name: 'Morpho Blue', value: 557_000_000 },
				{ name: 'Across', value: 100_000_000 }
			]
		},
		withoutBridges: {
			value: 3_780_000_000,
			changeUsd: -70_000_000,
			changePct: -1.8,
			bars: [{ name: 'Morpho Blue', value: 557_000_000 }]
		}
	},
	chainChange: {
		value: 32_000_000_000,
		changeUsd: 654_000_000,
		changePct: 2.09,
		bars: [
			{ name: 'Solana', changeUsd: 417_000_000, changePct: 20.3 },
			{ name: 'Aptos', changeUsd: 100_000_000, changePct: 1463.2 },
			{ name: 'BSC', changeUsd: -310_000_000, changePct: -6.2 }
		]
	},
	perpsOpenInterest: {
		withCex: {
			value: 15_700_000_000,
			changePct: 33.87,
			series: [
				[0, 10],
				[DAY, 15]
			]
		},
		dexOnly: {
			value: 5_000_000_000,
			changePct: -4,
			series: [
				[0, 6],
				[DAY, 5]
			]
		}
	}
}

describe('RWAOverviewCards', () => {
	test('formats each card value, signed change and bar change with its percent', () => {
		const markup = renderToStaticMarkup(<RWAOverviewCards cards={cards} includeBridgeTvl includeCex />)
		expect(markup).toContain('$3.88b')
		expect(markup).toContain('-$79.5m')
		expect(markup).toContain('protocols/morpho-blue')
		expect(markup).toContain('chains/rsz_solana')
		expect(markup).toContain('+$654m')
		expect(markup).toContain('+2.09%')
		expect(markup).toContain('+$417m')
		expect(markup).toContain('(+20.3%)')
		expect(markup).toContain('(+1463%)')
		expect(markup).toContain('-$310m')
		expect(markup).toContain('$15.7b')
		expect(markup).toContain('+33.87%')
	})

	test('names the comparison window beside each change', () => {
		const text = renderToStaticMarkup(<RWAOverviewCards cards={cards} includeBridgeTvl includeCex />).replace(
			/<[^>]+>/g,
			''
		)
		expect(text).toContain('$3.88b-$79.5mover 30d')
		expect(text).toContain('Change by Chain+$654m+2.09%over 30d')
	})

	test('follows the Bridge TVL and CEX toggles', () => {
		const markup = renderToStaticMarkup(<RWAOverviewCards cards={cards} includeBridgeTvl={false} includeCex={false} />)
		expect(markup).toContain('$3.78b')
		expect(markup).not.toContain('Across')
		expect(markup).toContain('$5b')
		expect(markup).toContain('-4.00%')
	})

	test('says unavailable when a card has no value', () => {
		const empty: RwaOverviewCards = {
			...cards,
			perpsOpenInterest: {
				withCex: { value: null, changePct: null, series: [] },
				dexOnly: { value: null, changePct: null, series: [] }
			}
		}
		const markup = renderToStaticMarkup(<RWAOverviewCards cards={empty} includeBridgeTvl includeCex />)
		expect(markup).toContain('Unavailable')
	})
})
