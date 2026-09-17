import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { RWATableControls } from '../toolbar/TableControls'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa', asPath: '/rwa', push: vi.fn(), replace: vi.fn() })
}))

const noop = () => {}

describe('RWATableControls', () => {
	test('renders the view switch before the Group by select, with no CEX toggle in the Assets view', () => {
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
		expect(markup.indexOf('Perps')).toBeLessThan(markup.indexOf('Group by: Platform'))
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

describe('RWATableControls on a platform page', () => {
	test('mounts the platform view switch first and never the Perps switch on a platform page', () => {
		const markup = renderToStaticMarkup(
			<RWATableControls
				view="assets"
				onViewChange={noop}
				groupBy="none"
				groupByScope="platform"
				onGroupByChange={noop}
				includeCex={false}
				onIncludeCexChange={noop}
				viewSwitch={<span>Platform views</span>}
				showPerpsSwitch={false}
			/>
		)
		expect(markup.indexOf('Platform views')).toBeLessThan(markup.indexOf('Group by: None'))
		expect(markup).not.toContain('Perps')
	})

	test('hides the Group by when asked, and keeps the Perps switch when the page has perps rows', () => {
		const markup = renderToStaticMarkup(
			<RWATableControls
				view="assets"
				onViewChange={noop}
				groupBy="none"
				groupByScope="platform"
				onGroupByChange={noop}
				includeCex={false}
				onIncludeCexChange={noop}
				viewSwitch={<span>Platform views</span>}
				showGroupBy={false}
			/>
		)
		expect(markup).not.toContain('Group by')
		expect(markup).toContain('Perps')
	})
})
