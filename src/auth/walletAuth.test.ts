// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}
import { BaseAuthStore } from 'pocketbase'
import { createSiweMessage } from 'viem/siwe'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { rememberSignIn } from '~/auth/lastSignIn'
import pb from '~/utils/pocketbase'
import { signInWithWallet } from './walletAuth'

const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const session = { token: 'wallet-token', record: { id: 'wallet-user', collectionId: 'users', collectionName: 'users' } }
const signMessage = vi.fn(async (_message: string) => '0x1234' as const)
const onAuthenticated = vi.fn()
const onStage = vi.fn()
let controller: AbortController
let resolveNonce: (response: Response) => void
let resolveAuth: (response: Response) => void
const request = () =>
	({
		address,
		connectorId: 'io.rabby',
		signal: controller.signal,
		canAccept: () => true,
		signMessage,
		onStage,
		onAuthenticated
	}) as const

beforeEach(() => {
	pb.authStore.clear()
	localStorage.clear()
	controller = new AbortController()
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url) => {
			const path = new URL(String(url)).pathname
			if (path === '/nonce')
				return new Promise<Response>((resolve) => {
					resolveNonce = resolve
				})
			if (path === '/eth-auth')
				return new Promise<Response>((resolve) => {
					resolveAuth = resolve
				})
			if (path.endsWith('/auth-with-password')) return Response.json(session)
			throw new Error(`Unexpected request: ${url}`)
		})
	)
})
afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
	vi.clearAllMocks()
	pb.authStore.clear()
})

async function approveNonce() {
	await vi.waitFor(() => expect(resolveNonce).toBeTypeOf('function'))
	resolveNonce(Response.json({ nonce: '12345678' }))
	await vi.waitFor(() => expect(signMessage).toHaveBeenCalledOnce())
}

test.each(['linked', 'issued', 'legacy'])(
	'accepts an existing %s account, preserving the server SIWE message',
	async (kind) => {
		const result = signInWithWallet(request())
		await approveNonce()
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
		const body = JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string)
		expect(body.message).toBe(
			createSiweMessage({
				address,
				domain: 'defillama.com',
				uri: 'https://defillama.com',
				statement: 'Sign in with Ethereum to the app.',
				version: '1',
				chainId: 1,
				nonce: '12345678',
				issuedAt: new Date(body.issuedAt)
			})
		)
		resolveAuth(
			Response.json(
				kind === 'linked'
					? { impersonate: session }
					: kind === 'issued'
						? { identity: address, password: 'one-time', auth: session }
						: { identity: address, password: 'one-time' }
			)
		)
		expect(await result).toMatchObject({ id: 'wallet-user' })
		expect(pb.authStore.token).toBe(session.token)
		// Only the legacy response still finishes the login against PocketBase directly.
		expect(fetch).toHaveBeenCalledTimes(kind === 'legacy' ? 3 : 2)
		expect(JSON.parse(localStorage.getItem('last-sign-in')!)).toEqual({ method: 'wallet', connectorId: 'io.rabby' })
		expect(onAuthenticated).toHaveBeenCalledOnce()
	}
)

test.each(['closed', 'session replaced'])('never requests a signature after the attempt is %s', async (reason) => {
	rememberSignIn({ method: 'email' })
	const result = signInWithWallet(request())
	if (reason === 'closed') controller.abort()
	else pb.authStore.save('new-token', null)
	resolveNonce(Response.json({ nonce: '12345678' }))
	expect(await result).toBeNull()
	expect(signMessage).not.toHaveBeenCalled()
	expect(JSON.parse(localStorage.getItem('last-sign-in')!)).toEqual({ method: 'email' })
	expect(onAuthenticated).not.toHaveBeenCalled()
})

test('keeps late legacy SDK store writes private after cancellation', async () => {
	let finishPassword!: (response: Response) => void
	const originalFetch = fetch
	vi.stubGlobal(
		'fetch',
		vi.fn((url, options) =>
			String(url).endsWith('/auth-with-password')
				? new Promise<Response>((resolve) => {
						finishPassword = resolve
					})
				: originalFetch(url, options)
		)
	)
	const saved = vi.spyOn(BaseAuthStore.prototype, 'save')
	const result = signInWithWallet(request())
	await approveNonce()
	await vi.waitFor(() => expect(resolveAuth).toBeTypeOf('function'))
	resolveAuth(Response.json({ identity: address, password: 'one-time' }))
	await vi.waitFor(() => expect(finishPassword).toBeTypeOf('function'))
	controller.abort()
	finishPassword(Response.json(session))
	expect(await result).toBeNull()
	expect(saved).toHaveBeenCalledWith(session.token, session.record)
	expect(pb.authStore.token).toBe('')
	expect(onAuthenticated).not.toHaveBeenCalled()
})

test('requests a fresh nonce on a deliberate retry instead of reusing a consumed cached nonce', async () => {
	const cachedNonces = new Map<string, string>()
	let storedNonce: string | null = null
	let signedNonce = ''
	signMessage.mockImplementation(async (message) => {
		signedNonce = message.match(/Nonce: (.+)/)![1]
		return '0x1234'
	})
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url) => {
			const key = String(url)
			if (new URL(key).pathname === '/nonce') {
				if (!cachedNonces.has(key)) {
					storedNonce = `nonce${cachedNonces.size + 1}0000`
					cachedNonces.set(key, storedNonce)
				}
				return Response.json({ nonce: cachedNonces.get(key) })
			}
			if (signedNonce !== storedNonce) return Response.json({ error: 'Invalid or expired nonce.' }, { status: 401 })
			storedNonce = null
			return Response.json({ error: 'No account was registered with this wallet address.' }, { status: 404 })
		})
	)
	for (let attempt = 0; attempt < 2; attempt++) {
		await expect(signInWithWallet(request())).rejects.toThrow('No account was registered with this wallet address.')
		// Failure waits for another click; it must not prompt the wallet again by itself.
		expect(signMessage).toHaveBeenCalledTimes(attempt + 1)
	}
	expect(cachedNonces.size).toBe(2)
	expect(pb.authStore.token).toBe('')
})
