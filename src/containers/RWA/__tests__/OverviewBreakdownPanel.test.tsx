import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { RWAOverviewBreakdownPanel, type RWAOverviewBreakdownPanelProps } from '../OverviewBreakdownPanel'
import { getRankedRwaFilterValues } from '../rankedFilterValues'
import { spotAsset } from '../table/__tests__/fixtures'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, pathname: '/rwa', asPath: '/rwa', push: vi.fn(), replace: vi.fn() })
}))

function render(props: Partial<RWAOverviewBreakdownPanelProps> = {}) {
	const onTreemapNestedByChange = vi.fn()
	const full: RWAOverviewBreakdownPanelProps = {
		view: 'pie',
		axis: 'assetGroup',
		metric: 'activeMcap',
		metricLabel: 'Active AUM',
		groupLabel: 'Asset Group',
		exportTitle: 'RWA Active AUM',
		filenameSuffix: 'active-mcap-all',
		treemapNestedBy: 'none',
		onTreemapNestedByChange,
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
	return { markup: renderToStaticMarkup(<RWAOverviewBreakdownPanel {...full} />), onTreemapNestedByChange }
}

describe('RWAOverviewBreakdownPanel', () => {
	test('renders the shared toolbar start, the exports and no nesting select for the pie', () => {
		const { markup } = render()
		expect(markup).toContain('toolbar-start')
		expect(markup).toContain('.csv')
		expect(markup).toContain('.png')
		expect(markup).not.toContain('Nested by')
	})

	test('offers the nesting select and the restore button for the treemap', () => {
		const { markup } = render({ view: 'treemap', treemapNestedBy: 'assetName' })
		expect(markup).toContain('Nested by: Asset Name')
	})

	test('gives the bar and pie views a minimum height and lets the treemap grow', () => {
		expect(render({ view: 'hbar' }).markup).toContain('min-h-[420px]')
		expect(render({ view: 'treemap' }).markup).not.toContain('min-h-[420px]')
	})
})
