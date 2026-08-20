import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PreTgePerformance } from '../PreTgePerformance'
import { NoDataPlaceholder } from '../TokenPage'
import { TopMovers } from '../TopMovers'

describe('UTR empty states', () => {
	it('renders NO DATA YET for empty metric sections', () => {
		expect(renderToStaticMarkup(<NoDataPlaceholder />)).toContain('NO DATA YET')
	})

	it('renders NO DATA YET when MoM data is unavailable', () => {
		expect(renderToStaticMarkup(<TopMovers movers={[]} />)).toContain('NO DATA YET')
	})

	it('keeps explicit mover signs while using canonical percent formatting', () => {
		const html = renderToStaticMarkup(
			<TopMovers
				movers={[
					{ asset: 'flat', name: 'Flat', momChangePct: 0 },
					{ asset: 'down', name: 'Down', momChangePct: -1.234 }
				]}
			/>
		)

		expect(html).toContain('+0%')
		expect(html).toContain('-1.23%')
	})

	it('keeps available fundraising metadata and marks missing metrics', () => {
		const html = renderToStaticMarkup(<PreTgePerformance hasFundraising lastRound="Strategic" />)

		expect(html).toContain('Strategic')
		expect(html).toContain('NO DATA YET')
	})
})
