import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import type { IChainOverviewData } from '../types'

vi.mock('~/layout', () => ({
	default: ({ announcement, children }: { announcement?: React.ReactNode; children?: React.ReactNode }) =>
		React.createElement(
			React.Fragment,
			null,
			announcement,
			React.createElement('div', null, 'METRICS-MARKER'),
			children
		)
}))
vi.mock('~/containers/ChainOverview', () => ({
	ChainOverview: () => React.createElement('div', null, 'OVERVIEW-MARKER')
}))
vi.mock('~/containers/ChainOverview/Announcement', () => ({
	ChainOverviewAnnouncement: () => React.createElement('div', null, 'ANNOUNCEMENT-MARKER')
}))
vi.mock('~/containers/ChainOverview/WarningBanners', () => ({
	ChainWarningBanners: () => React.createElement('div', null, 'WARNING-MARKER')
}))

import ChainPage from '../../../pages/chain/[chain]'

test('renders chain warning banners directly below the announcement before layout metrics', () => {
	const Page = ChainPage as React.ComponentType<IChainOverviewData>
	const props = {
		allChains: [],
		metadata: { name: 'Arbitrum Nova' },
		entityQuestions: [],
		isDataAvailable: true,
		protocols: []
	} as unknown as IChainOverviewData
	const markup = renderToStaticMarkup(React.createElement(Page, props))

	expect(markup.indexOf('ANNOUNCEMENT-MARKER')).toBeLessThan(markup.indexOf('WARNING-MARKER'))
	expect(markup.indexOf('WARNING-MARKER')).toBeLessThan(markup.indexOf('METRICS-MARKER'))
	expect(markup.indexOf('METRICS-MARKER')).toBeLessThan(markup.indexOf('OVERVIEW-MARKER'))
})
