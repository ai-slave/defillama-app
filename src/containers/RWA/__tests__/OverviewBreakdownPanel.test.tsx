import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { RWAOverviewBreakdownPanel, type RWAOverviewBreakdownPanelProps } from '../OverviewBreakdownPanel'
import { getRankedRwaFilterValues } from '../rankedFilterValues'
import { spotAsset } from '../table/__tests__/fixtures'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa', asPath: '/rwa', push: vi.fn(), replace: vi.fn() })
}))

function render(props: Partial<RWAOverviewBreakdownPanelProps> = {}) {
	const full: RWAOverviewBreakdownPanelProps = {
		view: 'pie',
		axis: 'assetGroup',
		metric: 'activeMcap',
		metricLabel: 'Active AUM',
		groupLabel: 'Asset Group',
		exportTitle: 'RWA Active AUM',
		filenameSuffix: 'active-mcap-all',
		treemapNestedBy: 'none',
		onTreemapNestedByChange: () => {},
		assets: [spotAsset(), spotAsset({ id: 'gold', canonicalMarketId: 'paxos/paxg', assetGroup: 'Precious Metals' })],
		rankedFilterValues: getRankedRwaFilterValues({
			typeOptions: [],
			categoriesOptions: [],
			assetClassOptions: [],
			rwaClassificationOptions: [],
			accessModelOptions: []
		}),
		selectedAssetNames: [],
		selectedCategories: [],
		isAssetGroupMode: false,
		includeBridgeTvl: true,
		toolbarStart: <span>toolbar-start</span>,
		...props
	}
	return { markup: renderToStaticMarkup(<RWAOverviewBreakdownPanel {...full} />) }
}

describe('RWAOverviewBreakdownPanel', () => {
	test('offers the treemap nesting control only on the treemap view', () => {
		expect(render({ view: 'treemap', treemapNestedBy: 'assetName' }).markup).toContain('Nested by: Asset Name')
		expect(render({ view: 'pie' }).markup).not.toContain('Nested by')
	})
})
