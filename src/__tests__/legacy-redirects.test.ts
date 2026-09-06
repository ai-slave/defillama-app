import { describe, expect, test, vi } from 'vitest'
import { getServerSideProps as getDexRedirectServerSideProps } from '~/pages/dexs/[item]'

vi.mock('~/utils/telemetry', () => ({
	withServerSidePropsTelemetry: (_route: string, handler: any) => handler
}))

describe('legacy redirect shims', () => {
	test('encodes dynamic params as a single destination segment', async () => {
		await expect(getDexRedirectServerSideProps({ params: { item: 'foo/bar' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/protocol/dexs/foo%2Fbar',
				permanent: true
			}
		})
	})

	test('returns notFound when the dynamic param is missing', async () => {
		await expect(getDexRedirectServerSideProps({ params: {} } as never)).resolves.toEqual({ notFound: true })
	})
})
