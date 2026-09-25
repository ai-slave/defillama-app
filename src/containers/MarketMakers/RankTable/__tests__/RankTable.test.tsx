import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { VOLUME_COLUMNS } from '../../constants'
import { RankTable } from '../index'

describe('RankTable', () => {
	test('lists the best-ranked market maker first by default', () => {
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

	test('shows the empty state when there are no rows', () => {
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
