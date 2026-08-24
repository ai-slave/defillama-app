import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChangeBadge, holderDistributionShares } from './HoldersPanel'
import type { Holder, HolderChange } from './types'

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
	it('renders unknown and null directional deltas as unavailable', () => {
		expect(renderToStaticMarkup(<ChangeBadge delta={{ status: 'unknown', value: null }} />)).toContain('—')
		expect(renderToStaticMarkup(<ChangeBadge delta={{ status: 'up', value: null }} />)).toContain('—')
		expect(renderToStaticMarkup(<ChangeBadge delta={{ status: 'down', value: null }} />)).toContain('—')
	})

	it('reserves Steady for the explicit steady status', () => {
		expect(renderToStaticMarkup(<ChangeBadge delta={{ status: 'steady', value: null }} />)).toContain('Steady')
		expect(renderToStaticMarkup(<ChangeBadge delta={{ status: 'unknown', value: null }} />)).not.toContain('Steady')
	})

	it('keeps known directional deltas numeric', () => {
		const html = renderToStaticMarkup(<ChangeBadge delta={{ status: 'up', value: 1.25 }} />)
		expect(html).toContain('1.3%')
		expect(html).not.toContain('—')
	})
})

describe('holder distribution shares', () => {
	it('does not manufacture a partial distribution when any share is null', () => {
		expect(holderDistributionShares([holder(25), holder(null)], null)).toBeNull()
	})

	it('keeps complete shares and a served top-10 total', () => {
		expect(holderDistributionShares([holder(25), holder(15)], 50)).toEqual({
			shares: [25, 15],
			top10: 50,
			others: 50
		})
	})
})
