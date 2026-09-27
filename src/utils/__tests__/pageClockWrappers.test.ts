import type { GetServerSidePropsContext, GetStaticPropsContext } from 'next'
import { afterEach, describe, expect, test, vi } from 'vitest'

describe('page clock at the data-function seam', () => {
	afterEach(() => {
		vi.useRealTimers()
		vi.resetModules()
		vi.unstubAllGlobals()
	})

	test('every static page result with props carries the second it was built', async () => {
		vi.useFakeTimers({ now: 1_700_000_000_000 })
		const { withPerformanceLogging } = await import('../perf')
		const wrapped = withPerformanceLogging('calendar', async () => ({ props: { rows: 3 }, revalidate: 3600 }))
		const result = await wrapped({} as GetStaticPropsContext)
		expect(result).toMatchObject({ props: { rows: 3, pageClockSec: 1_700_000_000 } })

		const missing = withPerformanceLogging('calendar', async () => ({ notFound: true as const }))
		expect(await missing({} as GetStaticPropsContext)).toEqual({ notFound: true })
	})

	test('every server-side page result with props carries the second of the request', async () => {
		vi.useFakeTimers({ now: 1_700_000_000_000 })
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 204 }))
		)
		const { withServerSidePropsTelemetry } = await import('../telemetry')
		const handler = withServerSidePropsTelemetry('/yields/pool/[pool]', async () => ({ props: { id: 'abc' } }))
		const context = {
			req: { method: 'GET', headers: {} },
			res: { statusCode: 200, setHeader: () => undefined, getHeader: () => undefined },
			resolvedUrl: '/yields/pool/abc',
			params: { pool: 'abc' },
			query: {}
		} as unknown as GetServerSidePropsContext
		expect(await handler(context)).toEqual({ props: { id: 'abc', pageClockSec: 1_700_000_000 } })
	})
})
