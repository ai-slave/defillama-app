// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PortfolioNotifications } from '../index'

const api = vi.hoisted(() => ({ fetch: vi.fn(), write: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		authorizedFetch: api.fetch,
		isAuthenticated: true,
		hasActiveSubscription: true,
		loaders: { userLoading: false }
	})
}))
vi.mock('~/utils/pocketbase', () => ({
	default: { authStore: { token: 'test', record: { id: 'user' }, onChange: vi.fn() } }
}))
vi.mock('react-hot-toast', () => ({
	default: { success: api.success, error: api.error },
	toast: { success: api.success, error: api.error }
}))
let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	vi.clearAllMocks()
	vi.spyOn(console, 'error').mockImplementation(() => {})
	api.fetch.mockImplementation((_url, init) =>
		init?.method === 'GET'
			? Promise.resolve(
					Response.json({
						preferences: {
							id: 'preference',
							active: true,
							settings: { protocols: { aave: ['tvl'] } },
							frequency: 'weekly'
						}
					})
				)
			: api.write()
	)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	vi.restoreAllMocks()
})
const settle = () =>
	act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 20))
	})
async function mount() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<PortfolioNotifications selectedPortfolio="QA" filteredProtocols={[{ slug: 'aave' }]} />
			</QueryClientProvider>
		)
	)
	await settle()
}
function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(element) => element.textContent?.trim() === name
	)!
}
test.each(['Disable', 'Delete'])(
	'%s handles failure, releases pending controls, and allows a successful retry',
	async (action) => {
		let fail!: (response: Response) => void
		api.write
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						fail = resolve
					})
			)
			.mockResolvedValueOnce(new Response(null, { status: 204 }))
		await mount()
		await act(async () => button(action).click())
		await settle()
		expect(button(action === 'Disable' ? 'Disabling...' : 'Deleting...').disabled).toBe(true)
		await act(async () => fail(new Response('Temporary failure', { status: 503 })))
		await settle()
		expect(api.error).toHaveBeenCalledExactlyOnceWith('Temporary failure')
		expect(button(action).disabled).toBe(false)
		await act(async () => button(action).click())
		await settle()
		expect(api.write).toHaveBeenCalledTimes(2)
		expect(api.success).toHaveBeenCalledOnce()
	}
)
