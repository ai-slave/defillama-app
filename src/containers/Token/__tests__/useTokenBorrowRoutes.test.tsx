// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { useTokenBorrowRoutes } from '../useTokenBorrowRoutes'

const http = installFixtureFetch()
let root: Root
let container: HTMLDivElement
let client: QueryClient
function Probe({ tokenKeys, enabled = true }: { tokenKeys: Array<string>; enabled?: boolean }) {
	const result = useTokenBorrowRoutes(tokenKeys, { enabled })
	return <output>{JSON.stringify(result.data ?? null)}</output>
}
async function render(tokenKeys: Array<string>, enabled = true) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Probe tokenKeys={tokenKeys} enabled={enabled} />
			</QueryClientProvider>
		)
	)
}
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})
test('keeps collateral and borrowing results separate when the selected token changes', async () => {
	http.serve({
		'/api/public/yields/borrow-routes': (url: URL) => {
			const params = url.searchParams
			expect(params.get('pageSize')).toBe('all')
			expect(params.get('includeMemeTokens')).toBe('true')
			const leg = params.has('collateralToken') ? 'collateralToken' : 'borrowToken'
			return { rows: [{ route: `${leg}:${params.getAll(leg).join(',')}` }] }
		}
	})
	async function selectToken(token: string) {
		await render([token])
		await waitForUi(() =>
			expect(JSON.parse(container.textContent!)).toEqual({
				useAsCollateral: [{ route: `collateralToken:${token}` }],
				borrowThis: [{ route: `borrowToken:${token}` }]
			})
		)
	}
	await selectToken('family:btc')
	await selectToken('asset:eth')
})
test.each([
	{ keys: [], enabled: true },
	{ keys: ['family:btc'], enabled: false }
])(
	'waits for a resolved token with fetching enabled before requesting each leg once (%j)',
	async ({ keys, enabled }) => {
		http.serve({ '/api/public/yields/borrow-routes': { rows: [] } })
		await render(keys, enabled)
		expect(container.textContent).toBe('null')
		expect(http.requests).toHaveLength(0)

		await render(['family:btc'])
		await waitForUi(() => expect(JSON.parse(container.textContent!)).toEqual({ useAsCollateral: [], borrowThis: [] }))
		const legs = http.requests.map((request) =>
			request.url.searchParams.has('collateralToken') ? 'collateral' : 'borrow'
		)
		expect(legs.toSorted()).toEqual(['borrow', 'collateral'])
	}
)
