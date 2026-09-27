import { expect, test } from 'vitest'
import { getStaticProps } from '~/pages/market-makers/volume'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'

const http = installFixtureFetch()
const ROUTE = '/api/v1/public/market-maker/leaderboard/volume'

test('passes the volume rows through', async () => {
	const rows = [{ marketMakerId: 'lhava', marketMakerName: 'Lhava', rank: { value: 1, percentile: 100 } }]
	http.serve({ [ROUTE]: rows })
	const res = (await getStaticProps({})) as { props: unknown }
	expect(res.props).toEqual({ rows, pageClockSec: expect.any(Number) })
})

test('renders the page with no rows when the leaderboard request fails', async () => {
	http.serve({ [ROUTE]: fixtureStatus(404) })
	const res = (await getStaticProps({})) as { props: unknown }
	expect(res.props).toEqual({ rows: null, pageClockSec: expect.any(Number) })
})
