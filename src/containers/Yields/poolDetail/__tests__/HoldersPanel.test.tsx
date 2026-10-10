import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { ChangeBadge, holderDistributionShares } from '../HoldersPanel'
import type { Holder, HolderChange } from '../types'

const unknownChange: HolderChange = {
	share: { status: 'unknown', pct_point_delta: null },
	balance: { status: 'unknown', pct_delta: null }
}

function holder(sharePct: number | null): Holder {
	return {
		rank: 1,
		address: '0x0000000000000000000000000000000000000001',
		balance: null,
		share_pct: sharePct,
		change_7d: unknownChange,
		change_30d: unknownChange
	}
}

describe('holder movement badges', () => {
	test('renders unknown and null directional deltas as unavailable', () => {
		expect(renderToStaticMarkup(<ChangeBadge delta={{ status: 'unknown', value: null, unit: 'percent' }} />)).toContain(
			'—'
		)
		expect(renderToStaticMarkup(<ChangeBadge delta={{ status: 'up', value: null, unit: 'percent' }} />)).toContain('—')
		expect(renderToStaticMarkup(<ChangeBadge delta={{ status: 'down', value: null, unit: 'percent' }} />)).toContain(
			'—'
		)
	})

	test('reserves Steady for the explicit steady status', () => {
		expect(renderToStaticMarkup(<ChangeBadge delta={{ status: 'steady', value: null, unit: 'percent' }} />)).toContain(
			'Steady'
		)
		expect(
			renderToStaticMarkup(<ChangeBadge delta={{ status: 'unknown', value: null, unit: 'percent' }} />)
		).not.toContain('Steady')
	})

	test('keeps known directional deltas numeric, in percentage points for share', () => {
		const html = renderToStaticMarkup(<ChangeBadge delta={{ status: 'up', value: 1.25, unit: 'percent' }} />)
		expect(html).toContain('+1.25%')
		expect(html).not.toContain('—')
		expect(renderToStaticMarkup(<ChangeBadge delta={{ status: 'down', value: 0.5, unit: 'pp' }} />)).toContain(
			'-0.50pp'
		)
	})
})

describe('holder distribution shares', () => {
	test('does not manufacture a partial distribution when any share is null', () => {
		expect(holderDistributionShares([holder(25), holder(null)], null)).toBeNull()
	})

	test('keeps complete shares and a served top-10 total', () => {
		expect(holderDistributionShares([holder(25), holder(15)], 50)).toEqual({
			shares: [25, 15],
			top10: 50,
			others: 50
		})
	})
})
