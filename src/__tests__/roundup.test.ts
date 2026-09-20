import type { GetStaticProps } from 'next'
import { afterEach, expect, test, vi } from 'vitest'

const fetchWithPoolingOnServer = vi.hoisted(() => vi.fn())

vi.mock('~/utils/http-client', () => ({ fetchWithPoolingOnServer }))
vi.mock('~/utils/perf', () => ({
	withPerformanceLogging: (_label: string, fn: GetStaticProps) => fn
}))
vi.mock('~/utils/maxAgeForNext', () => ({ maxAgeForNext: () => 123 }))
vi.mock('~/components/Announcement', () => ({ Announcement: () => null }))
vi.mock('~/layout', () => ({ default: () => null }))
vi.mock('~/ui/Card', () => ({ Card: () => null }))

import { getStaticProps } from '~/pages/roundup'

afterEach(() => {
	vi.unstubAllEnvs()
	vi.restoreAllMocks()
	fetchWithPoolingOnServer.mockReset()
})

test.each([undefined, '', ' ', '\t\n'])('returns a revalidating 404 for missing or blank token %j', async (token) => {
	vi.stubEnv('ROUND_UP_BOT_TOKEN', token)
	vi.spyOn(console, 'warn').mockImplementation(() => undefined)
	await expect(getStaticProps({})).resolves.toEqual({ notFound: true, revalidate: 123 })
	expect(fetchWithPoolingOnServer).not.toHaveBeenCalled()
})

test('fetches roundup with a configured token', async () => {
	vi.stubEnv('ROUND_UP_BOT_TOKEN', 'token')
	fetchWithPoolingOnServer.mockResolvedValue(new Response('[]'))
	await expect(getStaticProps({})).resolves.toEqual({ props: { messages: [], date: '' }, revalidate: 123 })
	const headers = fetchWithPoolingOnServer.mock.calls[0][1].headers as Headers
	expect(headers.get('Authorization')).toBe('Bot token')
})

test('propagates upstream failures with a configured token', async () => {
	vi.stubEnv('ROUND_UP_BOT_TOKEN', 'token')
	fetchWithPoolingOnServer.mockResolvedValue(new Response(null, { status: 401, statusText: 'Unauthorized' }))
	await expect(getStaticProps({})).rejects.toThrow('Failed to fetch roundup messages: 401 Unauthorized')
})
