// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { UserSettingsSync } from '~/components/UserSettingsSync'
import { AUTH_SERVER } from '~/constants'
import { readAppStorage, writeAppStorage } from '~/contexts/LocalStorage'
import { notifyKeyChange } from '~/contexts/localStorageStore'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { useBookmarks } from '../useBookmarks'
import { USER_CONFIG_QUERY_KEY } from '../useUserConfig'

// The auth server's settings endpoint: `load` answers reads and `save` receives each posted snapshot.
const api = { load: vi.fn(), save: vi.fn() }
const session = installSubscriberSession('user')
const configKey = [...USER_CONFIG_QUERY_KEY, 'user']
let root: Root
let container: HTMLDivElement
const client = () => session.client
beforeEach(() => {
	vi.useFakeTimers()
	api.load.mockReset().mockImplementation(async () => new Response('{}'))
	api.save.mockReset().mockImplementation(async () => new Response('{}'))
	vi.spyOn(console, 'error').mockImplementation(() => {})
	session.serve({
		[`${AUTH_SERVER}/user/config`]: (_url: URL, init?: RequestInit) =>
			init?.method === 'POST' ? api.save(JSON.parse(init.body as string)) : api.load()
	})
	session.client.setDefaultOptions({ queries: { retry: false } })
	writeAppStorage({})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
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
			<session.Wrapper>
				<UserSettingsSync />
				<Bookmark name="Aave" />
				<Bookmark name="Uniswap" />
				<Bookmark name="Morpho" />
			</session.Wrapper>
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
	await act(async () => container.querySelectorAll('button')[0].click())
	// Past the storage store's own batching, but inside the settings debounce window.
	await act(async () => {
		await vi.advanceTimersByTimeAsync(500)
	})
	await add(1)
	expect(readAppStorage().DEFI_WATCHLIST?.main).toEqual({ aave: 'Aave', uniswap: 'Uniswap' })
	expect(api.save).toHaveBeenCalledExactlyOnceWith(readAppStorage())
	expect(client().getQueryData(configKey)).toEqual(readAppStorage())
})
test.each(['HTTP failure', 'network failure'])(
	'a %s does not acknowledge local edits and the same snapshot can retry',
	async (failure) => {
		if (failure === 'HTTP failure') api.save.mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
		else api.save.mockRejectedValueOnce(new TypeError('Failed to fetch'))
		await mount()
		await add(0)
		expect(client().getQueryData(configKey)).toEqual({})
		await act(async () => notifyKeyChange('DEFILLAMA'))
		await act(async () => {
			await vi.advanceTimersByTimeAsync(2100)
		})
		expect(api.save).toHaveBeenCalledTimes(2)
		expect(client().getQueryData(configKey)).toEqual(readAppStorage())
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
	expect(client().getQueryData(configKey)).toEqual(readAppStorage())
})

test('an edit immediately after remote settings load keeps the remote bookmarks', async () => {
	api.load.mockResolvedValue(Response.json({ DEFI_WATCHLIST: { main: { aave: 'Aave' } } }))
	await mount()
	await add(1)
	expect(api.save).toHaveBeenCalledExactlyOnceWith(readAppStorage())
	expect(readAppStorage().DEFI_WATCHLIST?.main).toEqual({ aave: 'Aave', uniswap: 'Uniswap' })
})

test('an edit during the initial fetch is merged and saved after the remote response arrives', async () => {
	let finish!: (response: Response) => void
	api.load.mockReturnValue(
		new Promise((resolve) => {
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
	const anotherToken = `e30.${btoa(JSON.stringify({ id: 'another-user', exp: 4_102_444_800 }))}.signature`
	const anotherRecord = { id: 'another-user', collectionId: '_pb_users_auth_', collectionName: 'users' }
	session.serve({ '/api/collections/users/auth-refresh': { token: anotherToken, record: anotherRecord } })
	pb.authStore.save(anotherToken, anotherRecord)
	await act(async () => {
		finish(new Response('{}'))
		await vi.advanceTimersByTimeAsync(1)
	})
	expect(api.save).toHaveBeenCalledOnce()
	expect(client().getQueryData([...USER_CONFIG_QUERY_KEY, 'another-user'])).toEqual({})
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
	expect(client().getQueryData(configKey)).toEqual(previousSettings)
})
