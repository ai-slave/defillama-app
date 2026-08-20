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

	it('keeps available fundraising metadata and marks missing metrics', () => {
		const html = renderToStaticMarkup(<PreTgePerformance hasFundraising lastRound="Strategic" />)

		expect(html).toContain('Strategic')
		expect(html).toContain('NO DATA YET')
	})
})
