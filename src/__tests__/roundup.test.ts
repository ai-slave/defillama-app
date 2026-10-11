import { afterEach, expect, test, vi } from 'vitest'
import { fetchRoundup } from '~/containers/Roundup/api'

const fetchWithPoolingOnServer = vi.hoisted(() => vi.fn())
vi.mock('~/utils/http-client', () => ({ fetchWithPoolingOnServer }))

afterEach(() => {
	vi.restoreAllMocks()
	fetchWithPoolingOnServer.mockReset()
})

test.each([undefined, '', ' ', '\t\n'])(
	'skips the roundup without fetching for missing or blank token %j',
	async (token) => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		await expect(fetchRoundup(token)).resolves.toBeNull()
		expect(fetchWithPoolingOnServer).not.toHaveBeenCalled()
	}
)

test('parses the latest roundup into section headers and linked titles', async () => {
	// Discord returns newest first; the roundup title message is the oldest part of the latest post.
	const messages = [
		{ content: '→ Aave ships V4 [2]\n[1]: https://a.example\n[2]: https://b.example' },
		{ content: '🦙 Llama News Round-Up | Sep 24\n📰 News\n→ Uniswap fee switch [1]\n1/2' },
		{ content: '🦙 Llama News Round-Up | Sep 23\nOlder post' }
	]
	fetchWithPoolingOnServer.mockResolvedValue(Response.json(messages))

	await expect(fetchRoundup('token')).resolves.toEqual({
		date: 'Sep 24',
		messages: ['📰 News', ['Uniswap fee switch', 'https://a.example'], ['Aave ships V4', 'https://b.example']]
	})
})

test('propagates upstream failures', async () => {
	fetchWithPoolingOnServer.mockResolvedValue(new Response(null, { status: 401, statusText: 'Unauthorized' }))
	await expect(fetchRoundup('token')).rejects.toThrow("Couldn't load roundup messages: 401 Unauthorized")
})
