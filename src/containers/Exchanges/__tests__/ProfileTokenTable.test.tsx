import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { mapMasterProfile } from '../master.mappers'
import { ProfileTokenTable } from '../ProfileTokenTable'
import { executionResponse, indexResponse, metadataResponse } from './masterFixture'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/exchange/venue' }) }))

test('keeps measured second rungs in the per-token table when the first is absent', () => {
	const index = indexResponse()
	index.segments.linear_perp!.pairs[0].execution = {
		...executionResponse().venues.venue,
		hours_covered: 100,
		notional_usd: 1000,
		inside_spread_pct: null,
		inside_measured_usd: 1000,
		realized_slippage_bps_10k: null,
		realized_slippage_bps_100k: 2,
		predicted_slippage_bps_100k: 2.5,
		markout_bps_1m: null,
		markout_bps_5m: 3
	}
	const profile = mapMasterProfile(index, metadataResponse(), { execution: null, ranks: null, methodology: null })
	const html = renderToStaticMarkup(<ProfileTokenTable profile={profile} />)
	expect(html).toContain('$100k')
	expect(html).toContain('$20.00')
	expect(html).toContain('5m')
	expect(html).toContain('+$3.00')
})
