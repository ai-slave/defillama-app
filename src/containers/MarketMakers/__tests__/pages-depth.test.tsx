import { expect, test } from 'vitest'
import { getStaticProps } from '~/pages/market-makers/depth'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'

const http = installFixtureFetch()
const ROUTE = '/api/v1/public/market-maker/leaderboard/depth'

test('passes the bucketed depth payload through for the default 30-day range', async () => {
	const payload = {
		depth50: [],
		depth100: [],
		depth200: [{ marketMakerId: 'amber', marketMakerName: 'Amber', marketMakerImageUrl: null, rank: { value: 1 } }]
	}
	http.serve({ [ROUTE]: payload })
	const res = (await getStaticProps({})) as { props: unknown }
	expect(res.props).toEqual({ payload })
	const range = http.requests[0].url.searchParams
	expect([range.has('start_date'), range.has('end_date')]).toEqual([true, true])
})

test('renders the page with no payload when the leaderboard request fails', async () => {
	http.serve({ [ROUTE]: fixtureStatus(404) })
	const res = (await getStaticProps({})) as { props: unknown }
	expect(res.props).toEqual({ payload: null })
})
