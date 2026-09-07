// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { UserSettingsSync } from '~/components/UserSettingsSync'
import { readAppStorage, writeAppStorage } from '~/contexts/LocalStorage'
import { notifyKeyChange } from '~/contexts/localStorageStore'
import { useBookmarks } from '../useBookmarks'
import { USER_CONFIG_QUERY_KEY } from '../useUserConfig'

const api = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn(), userId: 'user' as string | null }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: !!api.userId,
		user: api.userId ? { id: api.userId } : null,
		authorizedFetch: api.fetch
	})
}))
vi.mock('~/auth/authStore', () => ({
	getAuthStoreSnapshot: () => ({ record: api.userId ? { id: api.userId } : null })
}))
const configKey = [...USER_CONFIG_QUERY_KEY, 'user']
let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	vi.useFakeTimers()
	vi.clearAllMocks()
	api.userId = 'user'
	vi.spyOn(console, 'error').mockImplementation(() => {})
	api.save.mockResolvedValue(new Response('{}'))
	api.fetch.mockImplementation((_url, init) =>
		init?.method === 'POST' ? api.save(JSON.parse(init.body)) : Promise.resolve(new Response('{}'))
	)
	writeAppStorage({})
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	vi.useRealTimers()
	vi.restoreAllMocks()
})
function Bookmark({ name }: { name: string }) {
	const { addProtocol } = useBookmarks('defi')
	return (
		<button type="button" onClick={() => addProtocol(name)}>
			{name}
		</button>
	)
}
async function mount() {
	await act(async () => {
		root.render(
			<QueryClientProvider client={client}>
				<UserSettingsSync />
				<Bookmark name="Aave" />
				<Bookmark name="Uniswap" />
				<Bookmark name="Morpho" />
			</QueryClientProvider>
		)
	})
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1)
	})
}
async function add(index: number) {
	await act(async () => container.querySelectorAll('button')[index].click())
	await act(async () => {
		await vi.advanceTimersByTimeAsync(2100)
	})
}
test('multiple bookmark controls share one debounced settings save', async () => {
	await mount()
	await add(0)
	expect(api.save).toHaveBeenCalledExactlyOnceWith(readAppStorage())
	expect(client.getQueryData(configKey)).toEqual(readAppStorage())
})
test.each(['HTTP failure', 'missing response'])(
	'a %s does not acknowledge local edits and the same snapshot can retry',
	async (failure) => {
		api.save.mockResolvedValueOnce(failure === 'HTTP failure' ? new Response('Unavailable', { status: 503 }) : null)
		await mount()
		await add(0)
		expect(client.getQueryData(configKey)).toEqual({})
		await act(async () => notifyKeyChange('DEFILLAMA'))
		await act(async () => {
			await vi.advanceTimersByTimeAsync(2100)
		})
		expect(api.save).toHaveBeenCalledTimes(2)
		expect(client.getQueryData(configKey)).toEqual(readAppStorage())
	}
)
test('a later edit waits for the earlier save and then persists the latest snapshot', async () => {
	let finish!: (response: Response) => void
	api.save.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	await mount()
	await add(0)
	await add(1)
	expect(api.save).toHaveBeenCalledOnce()
	await act(async () => {
		finish(new Response('{}'))
		await vi.advanceTimersByTimeAsync(1)
	})
	expect(api.save).toHaveBeenCalledTimes(2)
	expect(api.save.mock.calls[1][0]).toEqual(readAppStorage())
	expect(client.getQueryData(configKey)).toEqual(readAppStorage())
})

test('an edit immediately after remote settings load is saved without echoing the remote snapshot', async () => {
	api.fetch.mockImplementation((_url, init) =>
		init?.method === 'POST'
			? api.save(JSON.parse(init.body))
			: Promise.resolve(Response.json({ DEFI_WATCHLIST: { main: { aave: 'Aave' } } }))
	)
	await mount()
	await add(1)
	expect(api.save).toHaveBeenCalledExactlyOnceWith(readAppStorage())
	expect(readAppStorage().DEFI_WATCHLIST?.main).toEqual({ aave: 'Aave', uniswap: 'Uniswap' })
})

test('an edit during the initial fetch is merged and saved after the remote response arrives', async () => {
	let finish!: (response: Response) => void
	api.fetch.mockImplementation((_url, init) =>
		init?.method === 'POST'
			? api.save(JSON.parse(init.body))
			: new Promise((resolve) => {
					finish = resolve
				})
	)
	await mount()
	await add(1)
	expect(api.save).not.toHaveBeenCalled()
	await act(async () => {
		finish(Response.json({ DEFI_WATCHLIST: { main: { aave: 'Aave' } } }))
		await vi.advanceTimersByTimeAsync(2100)
	})
	expect(api.save).toHaveBeenCalledExactlyOnceWith(readAppStorage())
	expect(readAppStorage().DEFI_WATCHLIST?.main).toEqual({ aave: 'Aave', uniswap: 'Uniswap' })
})

test('queued settings from a signed-out account never post with a new account session', async () => {
	let finish!: (response: Response) => void
	api.save.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	await mount()
	await add(0)
	await add(1)
	api.userId = 'another-user'
	await act(async () => {
		finish(new Response('{}'))
		await vi.advanceTimersByTimeAsync(1)
	})
	expect(api.save).toHaveBeenCalledOnce()
	expect(client.getQueryData([...USER_CONFIG_QUERY_KEY, 'another-user'])).toEqual({})
})

test('undoing an edit while its save is pending persists the previously saved snapshot again', async () => {
	await mount()
	await add(0)
	const previousSettings = readAppStorage()
	let finish!: (response: Response) => void
	api.save.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	await add(1)
	await act(async () => {
		writeAppStorage(previousSettings)
		await vi.advanceTimersByTimeAsync(2100)
	})
	expect(api.save).toHaveBeenCalledTimes(2)
	await act(async () => {
		finish(new Response('{}'))
		await vi.advanceTimersByTimeAsync(1)
	})
	expect(api.save).toHaveBeenCalledTimes(3)
	expect(api.save.mock.calls[2][0]).toEqual(previousSettings)
	expect(client.getQueryData(configKey)).toEqual(previousSettings)
})
