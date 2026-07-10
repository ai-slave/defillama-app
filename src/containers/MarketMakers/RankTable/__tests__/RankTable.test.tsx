import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('~/components/TagGroup', () => ({ TagGroup: () => <div>tag-group</div> }))

import { VOLUME_COLUMNS } from '../../constants'
import { RankTable } from '../index'

const rows = [
	{
		marketMakerId: 'lhava',
		marketMakerName: 'Lhava',
		marketMakerImageUrl: null,
		rank: { value: 1, percentile: 100 },
		metrics: { orderFillVolumeTotal: { value: 1744638, percentile: 100, rank: 1 } }
	}
]

describe('RankTable', () => {
	it('renders a row per market maker', () => {
		const html = renderToStaticMarkup(
			<RankTable
				rows={rows}
				columns={VOLUME_COLUMNS}
				mode="value"
				setMode={() => {}}
				onRefine={() => {}}
				onSelectMM={() => {}}
			/>
		)
		expect(html).toContain('Lhava')
	})
	it('sorts by rank ascending by default', () => {
		const unsorted = [
			{
				marketMakerId: 'b',
				marketMakerName: 'Bravo',
				marketMakerImageUrl: null,
				rank: { value: 2, percentile: 50 },
				metrics: { orderFillVolumeTotal: { value: 100, percentile: 50, rank: 2 } }
			},
			{
				marketMakerId: 'a',
				marketMakerName: 'Alpha',
				marketMakerImageUrl: null,
				rank: { value: 1, percentile: 100 },
				metrics: { orderFillVolumeTotal: { value: 200, percentile: 100, rank: 1 } }
			}
		]
		const html = renderToStaticMarkup(
			<RankTable
				rows={unsorted}
				columns={VOLUME_COLUMNS}
				mode="value"
				setMode={() => {}}
				onRefine={() => {}}
				onSelectMM={() => {}}
			/>
		)
		expect(html.indexOf('Alpha')).toBeLessThan(html.indexOf('Bravo'))
	})

	it('shows the empty state when there are no rows', () => {
		const html = renderToStaticMarkup(
			<RankTable
				rows={[]}
				columns={VOLUME_COLUMNS}
				mode="value"
				setMode={() => {}}
				onRefine={() => {}}
				onSelectMM={() => {}}
			/>
		)
		expect(html).toContain('did not provide any result')
	})
})
