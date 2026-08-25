import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchJson = vi.fn()

vi.mock('~/constants', () => ({
	PRE_IPO_SERVER_URL: 'https://example.com/pre-ipo/v1'
}))
vi.mock('~/utils/async', () => ({ fetchJson }))

beforeEach(() => {
	fetchJson.mockReset()
	fetchJson.mockResolvedValue({
		updatedAt: '2026-08-25T00:00:00.000Z',
		data: []
	})
})

function calledUrl(index: number): URL {
	const call = fetchJson.mock.calls[index]
	if (!call) throw new Error(`Missing fetchJson call ${index}`)
	return new URL(call[0])
}

describe('pre-IPO API URLs', () => {
	it('fetches the company directory without unsupported query parameters', async () => {
		const api = await import('../api')
		await api.fetchPreIpoCompanies()

		const url = calledUrl(0)
		expect(url.pathname).toBe('/pre-ipo/v1/companies-list')
		expect(url.search).toBe('')
	})

	it('uses the canonical company on every detail endpoint', async () => {
		const api = await import('../api')
		await api.fetchPreIpoCompanySummary('anthropic')
		await api.fetchPreIpoValuations('anthropic')
		await api.fetchPreIpoRaises('anthropic')
		await api.fetchPreIpoIntegrations('anthropic')

		const paths = ['/summary', '/valuations', '/raises', '/integrations']
		for (let index = 0; index < paths.length; index++) {
			const url = calledUrl(index)
			expect(url.pathname).toBe(`/pre-ipo/v1${paths[index]}`)
			expect(url.searchParams.get('company')).toBe('anthropic')
			expect(Array.from(url.searchParams.keys())).toEqual(['company'])
		}
	})
})
