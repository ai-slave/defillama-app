import { afterEach, describe, expect, test, vi } from 'vitest'
import { DIRECT_AUTH_SECRET_ENV_NAMES, DIRECT_URL_ENV_NAMES } from '../directApi'

async function importHttpClientWithEnv(env: Record<string, string | undefined>) {
	vi.resetModules()
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()

	for (const key of DIRECT_URL_ENV_NAMES) {
		vi.stubEnv(key, '')
	}
	for (const key of DIRECT_AUTH_SECRET_ENV_NAMES) {
		vi.stubEnv(key, '')
	}

	for (const [key, value] of Object.entries(env)) {
		if (value == null) {
			vi.stubEnv(key, '')
		} else {
			vi.stubEnv(key, value)
		}
	}

	const fetchMock = vi.fn(async () => new Response('{}'))
	vi.stubGlobal('fetch', fetchMock)
	const { fetchWithPoolingOnServer } = await import('../http-client')
	return { fetchMock, fetchWithPoolingOnServer }
}

function fetchedUrl(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): URL {
	const call = fetchMock.mock.calls[callIndex]
	if (!call) throw new Error(`missing fetch call ${callIndex}`)
	return new URL(String(call[0]))
}

describe('fetchWithPoolingOnServer direct API auth', () => {
	afterEach(() => {
		vi.resetModules()
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
	})

	test('appends the core backend secret to configured direct core API requests', async () => {
		const { fetchMock, fetchWithPoolingOnServer } = await importHttpClientWithEnv({
			API2_SECRET_KEY: 'core-secret',
			SERVER_URL: 'https://core.example.com/api/'
		})

		await fetchWithPoolingOnServer('https://core.example.com/api/config?view=compact')
		await fetchWithPoolingOnServer('https://core.example.com/api/v2/chains')

		const configUrl = fetchedUrl(fetchMock, 0)
		expect(configUrl.searchParams.get('view')).toBe('compact')
		expect(configUrl.searchParams.get('x-llama-pro-key')).toBe('core-secret')

		const v2Url = fetchedUrl(fetchMock, 1)
		expect(v2Url.pathname).toBe('/api/v2/chains')
		expect(v2Url.searchParams.get('x-llama-pro-key')).toBe('core-secret')
	})

	test('appends the core backend secret to URL object direct API requests', async () => {
		const { fetchMock, fetchWithPoolingOnServer } = await importHttpClientWithEnv({
			API2_SECRET_KEY: 'core-secret',
			SERVER_URL: 'https://core.example.com/api'
		})

		await fetchWithPoolingOnServer(new URL('https://core.example.com/api/config?view=compact'))

		const url = fetchedUrl(fetchMock)
		expect(url.searchParams.get('view')).toBe('compact')
		expect(url.searchParams.get('x-llama-pro-key')).toBe('core-secret')
	})

	test('appends direct auth for explicit V2, equities, and liquidations URL overrides', async () => {
		const { fetchMock, fetchWithPoolingOnServer } = await importHttpClientWithEnv({
			API2_SECRET_KEY: 'core-secret',
			EQUITIES_SECRET_KEY: 'equities-secret',
			EQUITIES_SERVER_URL: 'https://equities.example.com/v1/',
			LIQUIDATIONS_SECRET_KEY: 'liquidations-secret',
			LIQUIDATIONS_SERVER_URL_V2: 'https://liquidations.example.com/',
			V2_SERVER_URL: 'https://core-v2.example.com'
		})

		await fetchWithPoolingOnServer('https://core-v2.example.com/chains?chain=ethereum')
		await fetchWithPoolingOnServer('https://equities.example.com/v1/companies')
		await fetchWithPoolingOnServer('https://liquidations.example.com/all')

		expect(fetchedUrl(fetchMock, 0).searchParams.get('x-llama-pro-key')).toBe('core-secret')
		expect(fetchedUrl(fetchMock, 1).searchParams.get('x-llama-equity-secret')).toBe('equities-secret')
		expect(fetchedUrl(fetchMock, 2).searchParams.get('x-llama-secret')).toBe('liquidations-secret')
	})

	test('authenticates direct coins POST requests and preserves their body', async () => {
		const { fetchMock, fetchWithPoolingOnServer } = await importHttpClientWithEnv({
			COINS_BACKEND_KEY: 'coins-secret',
			COINS_SERVER_URL: 'https://coins.example.com'
		})
		const body = JSON.stringify({ coins: { 'coingecko:bitcoin': [1_700_000_000] }, searchWidth: '6h' })

		await fetchWithPoolingOnServer(
			'https://coins.example.com/pro/prices/historical?requestType=internal&x-coins-internal-key=old&x-coins-pro-key=old',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body
			}
		)

		const url = fetchedUrl(fetchMock)
		expect(url.searchParams.get('x-coins-pro-key')).toBe('coins-secret')
		expect(url.searchParams.get('requestType')).toBe('pro')
		expect(url.searchParams.has('x-coins-internal-key')).toBe(false)
		expect(fetchMock).toHaveBeenCalledWith(url.toString(), expect.objectContaining({ method: 'POST', body }))
	})

	test('does not attach coins credentials to Pro, unrelated hosts, or browser requests', async () => {
		const { fetchMock, fetchWithPoolingOnServer } = await importHttpClientWithEnv({
			COINS_BACKEND_KEY: 'coins-secret',
			COINS_SERVER_URL: 'https://coins.example.com'
		})
		await fetchWithPoolingOnServer('https://pro-api.llama.fi/key/coins/pro/prices/historical')
		await fetchWithPoolingOnServer('https://other.example.com/pro/prices/historical')
		vi.stubGlobal('window', {})
		await fetchWithPoolingOnServer('https://coins.example.com/prices/current')

		for (let index = 0; index < 3; index++) {
			expect(fetchedUrl(fetchMock, index).searchParams.has('x-coins-pro-key')).toBe(false)
			expect(fetchedUrl(fetchMock, index).searchParams.has('requestType')).toBe(false)
		}
	})

	test('preserves secret base paths when routing direct services with a Pro key also set', async () => {
		const { fetchMock, fetchWithPoolingOnServer } = await importHttpClientWithEnv({
			API_KEY: 'pro-key',
			RWA_PERPS_SERVER_URL: 'https://rwa-perps.example.com/rwa-secret/',
			YIELDS_V2_SERVER_URL: 'https://yields.example.com/yields-secret/',
			VAULT_RISK_SERVER_URL: 'https://vault-risk.example.com/vault-secret/'
		})
		const { RWA_PERPS_SERVER_URL, YIELDS_V2_SERVER_URL, VAULT_RISK_API } = await import('~/constants')

		await fetchWithPoolingOnServer(`${RWA_PERPS_SERVER_URL}/list?includeCex=true`)
		await fetchWithPoolingOnServer(`${YIELDS_V2_SERVER_URL}/v2/pools`)
		await fetchWithPoolingOnServer(VAULT_RISK_API)

		expect(fetchedUrl(fetchMock, 0).toString()).toBe('https://rwa-perps.example.com/rwa-secret/list?includeCex=true')
		expect(fetchedUrl(fetchMock, 1).toString()).toBe('https://yields.example.com/yields-secret/v2/pools')
		expect(fetchedUrl(fetchMock, 2).toString()).toBe('https://vault-risk.example.com/vault-secret/v1/vault-risks')
	})

	test('does not append direct auth for pro fallback or unrelated direct server URLs', async () => {
		const { fetchMock, fetchWithPoolingOnServer } = await importHttpClientWithEnv({
			API2_SECRET_KEY: 'core-secret',
			DATASETS_SERVER_URL: 'https://datasets.example.com'
		})

		await fetchWithPoolingOnServer('https://pro-api.llama.fi/pro-key/api/config')
		await fetchWithPoolingOnServer('https://datasets.example.com/tokenlist/sorted.json')

		expect(fetchedUrl(fetchMock, 0).searchParams.get('x-llama-pro-key')).toBeNull()
		expect(fetchedUrl(fetchMock, 1).searchParams.get('x-llama-pro-key')).toBeNull()
	})
})
