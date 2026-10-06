import { describe, expect, test } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { fetchPoolDetailCached, fetchPoolHistoryCached } from '../fetch.server'

const http = installFixtureFetch()

// The memo is module-level, so every test uses its own pool id.
function servePool(id: string) {
	http.serve({
		[`/v2/earn/${id}`]: { data: { id } },
		[`/v2/earn/verified/${id}`]: { data: { apy: { avg_1d: 1 } } },
		[`/v2/earn/${id}/history`]: (url: URL) => ({
			data: [{ date: `2026-01-0${url.searchParams.get('range') === 'max' ? 1 : 2}` }]
		}),
		[`/v2/earn/verified/${id}/history`]: { data: [{ date: '2026-01-01', apy: 4 }] }
	})
}

const requests = (path: string) => http.urls().filter((url) => new URL(url).pathname === path).length

describe('server-side pool fetch memo', () => {
	// Without it a subscriber's pool page fetches the same history twice: once for the render,
	// once for the private route that fills in its measured half.
	test('serves repeated reads of one range from a single upstream call', async () => {
		servePool('shared')

		await Promise.all([fetchPoolHistoryCached('shared', 'max'), fetchPoolHistoryCached('shared', 'max')])
		await fetchPoolHistoryCached('shared', 'max')
		expect(http.urls()).toHaveLength(1)

		expect(await fetchPoolHistoryCached('shared', '30d')).toEqual([{ date: '2026-01-02' }])
		expect(requests('/v2/earn/shared/history')).toBe(2)
	})

	test('memoizes the detail per pool without the measured sidecar', async () => {
		servePool('detail')

		await fetchPoolDetailCached('detail')
		expect(await fetchPoolDetailCached('detail')).toEqual({ id: 'detail' })

		expect(http.urls()).toHaveLength(1)
	})

	test('adds the verified sidecars only for an opted-in measured caller', async () => {
		servePool('verified')

		const detail = await fetchPoolDetailCached('verified', true)
		const history = await fetchPoolHistoryCached('verified', 'max', true)

		expect(detail).toEqual({ id: 'verified', verified: { apy: { avg_1d: 1 } } })
		expect(history).toEqual([{ date: '2026-01-01', verified: expect.objectContaining({ apy: 4 }) }])
	})
})
