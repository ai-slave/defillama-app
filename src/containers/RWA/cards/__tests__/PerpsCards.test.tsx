import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { foldRwaPerpsKpi } from '../../kpi/perpsKpi'
import { perpsAsset } from '../../table/__tests__/fixtures'
import type { RwaChangeCard } from '../cardData'
import type { RwaPerpsCards } from '../perpsCardData'
import { RWAPerpsCards, type RWAPerpsCardsProps } from '../PerpsCards'

const split = (name: string, changeUsd: number): RwaChangeCard => ({
	changeUsd,
	changePct: 5,
	bars: [{ name, changeUsd, changePct: 5 }]
})
const daily = (perDay: number) =>
	Array.from({ length: 10 }, (_, i): [number, number] => [Date.UTC(2026, 0, i + 1), (i + 1) * perDay])
const cards: RwaPerpsCards = {
	venueChange: { withCex: split('Binance', 50), dexOnly: split('Lighter', -20) },
	volume: { withCex: daily(1_000_000), dexOnly: daily(500_000) }
}
const markets = [
	perpsAsset({
		id: 'a',
		venueType: 'DEX',
		parentPlatform: 'Hyperliquid',
		assetGroup: 'Equities',
		openInterest: 2_000_000
	}),
	perpsAsset({
		id: 'b',
		venueType: 'CEX',
		parentPlatform: 'Binance',
		assetGroup: 'Commodities',
		openInterest: 3_000_000,
		fundingRate: -0.0001
	})
]

function render(props: Partial<RWAPerpsCardsProps> = {}) {
	const includeCex = props.includeCex ?? true
	const html = renderToStaticMarkup(
		<RWAPerpsCards
			cards={cards}
			markets={markets}
			kpi={foldRwaPerpsKpi(markets, includeCex)}
			filtered={false}
			venueHistory={null}
			volumeHistory={null}
			includeCex={includeCex}
			{...props}
		/>
	)
	return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

describe('RWAPerpsCards', () => {
	test('draws Open Interest by Asset Group with the Key Metrics total, Change by Venue and the 7 day volume line', () => {
		const text = render()
		expect(text).toContain('Open Interest by Asset Group $5m')
		expect(text).toContain('Change by Venue')
		expect(text).toMatch(/Volume, 7 day average \$7m a day \+250(\.00)?% over a week/)
		expect(text).not.toContain('RWA Perps Open Interest')
		expect(text).toContain('Commodities')
	})

	test('follows Venue Type DEX only: the asset groups, the server split variant and the DEX daily volume', () => {
		const text = render({ includeCex: false })
		expect(text).toContain('Open Interest by Asset Group $2m')
		expect(text).not.toContain('Commodities')
		expect(text).toContain('Lighter')
		expect(text).not.toContain('Binance')
		expect(text).toMatch(/Volume, 7 day average \$3\.5m a day/)
	})

	test('reads the folded per-market history for Change by Venue once a filter is set', () => {
		const text = render({
			filtered: true,
			venueHistory: {
				Hyperliquid: [
					[0, 100],
					[31 * 24 * 60 * 60 * 1000, 130]
				]
			}
		})
		expect(text).toContain('Change by Venue +$30 +30.00%')
		expect(text).not.toContain('Binance +$50')
	})

	test('reads Unavailable, never $0, when the markets have no open interest', () => {
		const empty = [perpsAsset({ openInterest: null })]
		const html = renderToStaticMarkup(
			<RWAPerpsCards
				cards={cards}
				markets={empty}
				kpi={foldRwaPerpsKpi(empty, true)}
				filtered={false}
				venueHistory={null}
				volumeHistory={null}
				includeCex
			/>
		)
		expect(html).toContain('Unavailable')
		expect(html).not.toContain('$0<')
	})
})
