// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}
import * as Ariakit from '@ariakit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { type Address, TimeoutError, UserRejectedRequestError } from 'viem'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createConfig, createConnector, http, ProviderNotFoundError, WagmiProvider, type Config } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { mock } from 'wagmi/connectors'
import { AuthProvider } from '~/auth'
import { AuthDialogHeader } from '~/auth/AuthDialog'
import { rememberSignIn } from '~/auth/lastSignIn'
import { createSignInFlowStore } from '~/auth/signInFlowStore'
import { Dialog } from '~/ui/Dialog'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import { WalletSignInForm } from '../WalletSignIn'

vi.mock('~/layout/WalletProviderClient', () => ({ WalletProviderClient: () => null }))
const first = '0x1111111111111111111111111111111111111111'
const second = '0x2222222222222222222222222222222222222222'
const session = { token: 'wallet-session', record: { id: 'wallet-user' } }
let root: Root
let container: HTMLDivElement
let config: Config
let chainId = 1
let address: Address = first
let store: ReturnType<typeof createSignInFlowStore>
let completeSignature: (signature: string) => void
let rejectSignature: (error: Error) => void
const requestedSignatures = vi.fn()
const onAuthenticated = vi.fn()
let pendingConnect: Promise<void> | undefined
let pendingDisconnect: Promise<void> | undefined

beforeEach(async () => {
	pb.authStore.clear()
	localStorage.clear()
	address = first
	chainId = 1
	pendingConnect = undefined
	pendingDisconnect = undefined
	requestedSignatures.mockClear()
	onAuthenticated.mockClear()
	config = createConfig({
		chains: [mainnet],
		transports: { 1: http() },
		storage: null,
		multiInjectedProviderDiscovery: false,
		connectors: [
			mock({ accounts: [first] }),
			createConnector(() => ({
				id: 'fixture',
				name: 'Fixture wallet',
				type: 'injected',
				async connect<withCapabilities extends boolean = false>(parameters?: {
					withCapabilities?: withCapabilities | boolean
				}) {
					await pendingConnect
					const accounts = parameters?.withCapabilities ? [{ address, capabilities: {} }] : [address]
					return {
						accounts: accounts as unknown as withCapabilities extends true
							? ReadonlyArray<{ address: Address; capabilities: Record<string, unknown> }>
							: ReadonlyArray<Address>,
						chainId
					}
				},
				async disconnect() {
					await pendingDisconnect
				},
				async getAccounts() {
					return [address]
				},
				async getChainId() {
					return chainId
				},
				async isAuthorized() {
					return false
				},
				async getProvider() {
					return {
						request: async ({ method }: { method: string }) => {
							if (method === 'eth_accounts') return [address]
							if (method === 'eth_chainId') return '0x1'
							if (method === 'personal_sign') {
								requestedSignatures()
								return new Promise<string>((resolve, reject) => {
									completeSignature = resolve
									rejectSignature = reject
								})
							}
							throw new Error(`Unexpected wallet request ${method}`)
						}
					}
				},
				onAccountsChanged() {},
				onChainChanged() {},
				onDisconnect() {}
			}))
		]
	})
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url) => {
			if (String(url).includes('/nonce?')) return Response.json({ nonce: '12345678' })
			if (String(url).endsWith('/eth-auth')) return Response.json({ impersonate: session })
			throw new Error(`Unexpected fetch ${url}`)
		})
	)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	store = createSignInFlowStore()
	store.dispatch({ kind: 'navigate', screen: 'wallet' })
	function Fixture() {
		const dialogStore = Ariakit.useDialogStore({ defaultOpen: true })
		const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
		return state.kind === 'wallet' ? (
			// The real surface, so a step that drops focus meets the dialog's net as it does in the sign-in dialog.
			<Dialog size="sm" store={dialogStore} portal={false}>
				<AuthDialogHeader
					title="Sign in with a wallet"
					closable={false}
					onBack={() => store.dispatch({ kind: 'navigate', screen: 'signin' })}
				/>
				<WalletSignInForm store={store} onAuthenticated={onAuthenticated} />
			</Dialog>
		) : (
			<p>Email sign-in</p>
		)
	}
	await act(async () =>
		root.render(
			<QueryClientProvider
				client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
			>
				<AuthProvider>
					<WagmiProvider config={config} reconnectOnMount={false}>
						<Fixture />
					</WagmiProvider>
				</AuthProvider>
			</QueryClientProvider>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
	pb.authStore.clear()
})
const button = (text: string) =>
	Array.from(container.querySelectorAll('button')).find((element) => accessibleName(element).startsWith(text))!
async function click(text: string) {
	await act(async () => button(text).click())
}
async function choose() {
	await click('Fixture wallet')
	await waitForUi(() => expect(container.textContent).toContain(first))
}
async function beginSigning() {
	await choose()
	await click('Sign in')
	await waitForUi(() => expect(requestedSignatures).toHaveBeenCalledOnce())
}

test('connects without signing, then signs only on the explicit button', async () => {
	await choose()
	expect(container.textContent).toContain(first)
	expect(fetch).not.toHaveBeenCalled()
	expect(requestedSignatures).not.toHaveBeenCalled()
	await click('Sign in')
	await waitForUi(() => expect(requestedSignatures).toHaveBeenCalledOnce())
	// A pending button stays focusable but ignores clicks.
	expect(button('Waiting for Fixture wallet…').getAttribute('aria-disabled')).toBe('true')
	await act(async () => completeSignature('0x1234'))
	await waitForUi(() => expect(pb.authStore.token).toBe(session.token))
	expect(onAuthenticated).toHaveBeenCalledOnce()
})

test.each(['address', 'network'])('invalidates signing after a %s change, even if it changes back', async (changed) => {
	await beginSigning()
	await act(async () => {
		if (changed === 'address') {
			address = second
			config.connectors[1].emitter.emit('change', { accounts: [address] })
		} else {
			chainId = 10
			config.connectors[1].emitter.emit('change', { chainId })
		}
	})
	expect(container.textContent).toContain('Your wallet changed.')
	await act(async () => {
		address = first
		chainId = 1
		config.connectors[1].emitter.emit('change', { accounts: [address], chainId })
		completeSignature('0x1234')
	})
	expect(pb.authStore.token).toBe('')
	expect(fetch).toHaveBeenCalledTimes(1)
	expect(button('Sign in').disabled).toBe(false)
})

test('puts an available last-used connector first without connecting it', async () => {
	await act(async () => rememberSignIn({ method: 'wallet', connectorId: 'mock' }))
	const remembered = button('Mock Connector')
	expect(remembered.compareDocumentPosition(button('Fixture wallet')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
	expect(remembered.textContent).toContain('Last used')
	expect(remembered.textContent).not.toContain('Installed')
	expect(button('Fixture wallet').textContent).toContain('Installed')
	expect(button('Fixture wallet').disabled).toBe(false)
	expect(config.state.connections.size).toBe(0)
	expect(requestedSignatures).not.toHaveBeenCalled()
	expect(fetch).not.toHaveBeenCalled()
})

test('keeps the available wallets usable when the remembered connector is absent', async () => {
	await act(async () => rememberSignIn({ method: 'wallet', connectorId: 'uninstalled.wallet' }))
	expect(container.textContent).not.toContain('Last used')
	expect(button('Fixture wallet').disabled).toBe(false)
	await choose()
	expect(container.textContent).toContain(first)
	expect(fetch).not.toHaveBeenCalled()
	expect(JSON.parse(localStorage.getItem('last-sign-in')!)).toEqual({
		method: 'wallet',
		connectorId: 'uninstalled.wallet'
	})
})

test('reopening reviews the retained connection without requesting a signature', async () => {
	await choose()
	await act(async () => store.dispatch({ kind: 'navigate', screen: 'signin' }))
	await act(async () => store.dispatch({ kind: 'navigate', screen: 'wallet' }))
	expect(container.textContent).toContain(first)
	expect(button('Sign in').disabled).toBe(false)
	expect(requestedSignatures).not.toHaveBeenCalled()
	expect(fetch).not.toHaveBeenCalled()
})

test('keeps the address during disconnect, then reopens on the picker', async () => {
	await choose()
	let finishDisconnect!: () => void
	pendingDisconnect = new Promise((resolve) => {
		finishDisconnect = resolve
	})
	await click('Disconnect')
	expect(container.textContent).toContain(first)
	await waitForUi(() => expect(button('Disconnecting…').getAttribute('aria-disabled')).toBe('true'))
	await act(async () => finishDisconnect())
	expect(button('Fixture wallet').disabled).toBe(false)
	await act(async () => store.dispatch({ kind: 'navigate', screen: 'signin' }))
	await act(async () => store.dispatch({ kind: 'navigate', screen: 'wallet' }))
	expect(container.textContent).not.toContain(first)
	expect(button('Fixture wallet').disabled).toBe(false)
})

test.each([
	[new UserRejectedRequestError(new Error('Rejected')), 'Signature declined. No sign-in was completed.'],
	[new Error('SDK internal details'), 'Your wallet did not complete the request. Try again or choose another wallet.'],
	[
		new TimeoutError({ body: {}, url: 'https://wallet.example' }),
		'The wallet did not respond in time. Check it for a pending request before trying again.'
	]
])('keeps signature failures on review with readable feedback: %s', async (error, message) => {
	await beginSigning()
	await act(async () => rejectSignature(error))
	expect(container.querySelector('[role="alert"]')?.textContent).toBe(message)
	expect(container.textContent).toContain(first)
	expect(button('Sign in').disabled).toBe(false)
	expect(fetch).toHaveBeenCalledTimes(1)
	expect(pb.authStore.token).toBe('')
})

test('explains an unavailable provider without exposing SDK details', async () => {
	let failConnect!: (error: Error) => void
	pendingConnect = new Promise((_resolve, reject) => {
		failConnect = reject
	})
	await click('Fixture wallet')
	await act(async () => failConnect(new ProviderNotFoundError()))
	expect(container.querySelector('[role="alert"]')?.textContent).toBe(
		'This wallet is unavailable in this browser. Open its app or choose another wallet.'
	)
	expect(button('Fixture wallet').disabled).toBe(false)
})

test('declining a connection quietly returns to the picker', async () => {
	let failConnect!: (error: Error) => void
	pendingConnect = new Promise((_resolve, reject) => {
		failConnect = reject
	})
	await click('Fixture wallet')
	await act(async () => failConnect(new UserRejectedRequestError(new Error('Rejected'))))
	await waitForUi(() => expect(button('Fixture wallet')?.disabled).toBe(false))
	expect(container.querySelector('[role="alert"]')).toBeNull()
	expect(requestedSignatures).not.toHaveBeenCalled()
})

test('choosing a wallet hands focus to the dialog during the wait, then to Sign in on the review', async () => {
	let finishConnect!: () => void
	pendingConnect = new Promise((resolve) => {
		finishConnect = resolve
	})
	await act(async () => button('Fixture wallet').focus())
	await click('Fixture wallet')
	await waitForUi(() => expect(container.textContent).toContain('Waiting for Fixture wallet'))
	await waitForUi(() => expect(document.activeElement).toBe(button('Back to sign in')))
	await act(async () => finishConnect())
	await waitForUi(() => expect(document.activeElement).toBe(button('Sign in')))
})

test('declining a connection keeps focus in the dialog instead of the page', async () => {
	let failConnect!: (error: Error) => void
	pendingConnect = new Promise((_resolve, reject) => {
		failConnect = reject
	})
	await act(async () => button('Fixture wallet').focus())
	await click('Fixture wallet')
	await act(async () => failConnect(new UserRejectedRequestError(new Error('Rejected'))))
	await waitForUi(() => expect(button('Fixture wallet')).toBeTruthy())
	expect(document.activeElement).toBe(button('Back to sign in'))
})

test('Disconnect hands focus to the dialog when the wallet list replaces the review', async () => {
	await choose()
	await act(async () => button('Disconnect').focus())
	await click('Disconnect')
	await waitForUi(() => expect(button('Fixture wallet')).toBeTruthy())
	await waitForUi(() => expect(document.activeElement).toBe(button('Back to sign in')))
})

test('preserves the backend explanation when the signed wallet has no account', async () => {
	await beginSigning()
	vi.mocked(fetch).mockResolvedValueOnce(
		Response.json({ error: 'No account registered with this wallet.' }, { status: 403 })
	)
	await act(async () => completeSignature('0x1234'))
	expect(container.querySelector('[role="alert"]')?.textContent).toBe('No account registered with this wallet.')
	expect(container.textContent).toContain(first)
	expect(button('Sign in').disabled).toBe(false)
	expect(pb.authStore.token).toBe('')
	expect(fetch).toHaveBeenCalledTimes(2)
	expect(onAuthenticated).not.toHaveBeenCalled()
})
