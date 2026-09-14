import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { RWATableControls } from '../toolbar/TableControls'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa', asPath: '/rwa', push: vi.fn(), replace: vi.fn() })
}))

const noop = () => {}

describe('RWATableControls', () => {
	test('renders the Group by select and the view switch, with no CEX toggle in the Assets view', () => {
		const markup = renderToStaticMarkup(
			<RWATableControls
				view="assets"
				onViewChange={noop}
				groupBy="platform"
				groupByScope="all"
				onGroupByChange={noop}
				includeCex={false}
				onIncludeCexChange={noop}
			/>
		)
		expect(markup).toContain('Group by: Platform')
		expect(markup).toContain('Assets')
		expect(markup).toContain('Perps')
		expect(markup).not.toContain('CEX Perps')
	})

	test('adds the CEX toggle in the Perps view and calls the platform Venue', () => {
		const markup = renderToStaticMarkup(
			<RWATableControls
				view="perps"
				onViewChange={noop}
				groupBy="platform"
				groupByScope="all"
				onGroupByChange={noop}
				includeCex
				onIncludeCexChange={noop}
			/>
		)
		expect(markup).toContain('Group by: Venue')
		expect(markup).toContain('CEX Perps')
		expect(markup).toContain('checked')
	})
})
