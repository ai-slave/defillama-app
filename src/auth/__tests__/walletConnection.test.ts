import { expect, test, vi } from 'vitest'
import { createConfig, createConnector, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { connectWallet } from '../walletConnection'

test.each([false, true])('cancelling also closes the SDK modal; modal opens late=%s', async (opensLate) => {
	let listener: ((state: { open: boolean }) => void) | undefined
	let finishOpening!: () => void
	let rejectConnection!: (error: Error) => void
	let open = false
	const gate = new Promise<void>((resolve) => {
		finishOpening = resolve
	})
	const approval = new Promise<never>((_, reject) => {
		rejectConnection = reject
	})
	const provider = {
		modal: {
			subscribeState(callback: typeof listener) {
				listener = callback
				return () => {
					listener = undefined
				}
			},
			close() {
				if (open) {
					open = false
					rejectConnection(new Error('Pairing cancelled'))
				}
			}
		}
	}
	const config = createConfig({
		chains: [mainnet],
		transports: { 1: http() },
		storage: null,
		multiInjectedProviderDiscovery: false,
		connectors: [
			createConnector(() => ({
				id: 'walletConnect',
				name: 'WalletConnect fixture',
				type: 'walletConnect',
				async connect() {
					await gate
					open = true
					listener?.({ open })
					return approval
				},
				async disconnect() {},
				async getProvider() {
					return provider
				},
				async getAccounts() {
					return []
				},
				async getChainId() {
					return 1
				},
				async isAuthorized() {
					return false
				},
				onAccountsChanged() {},
				onChainChanged() {},
				onDisconnect() {}
			}))
		]
	})
	const controller = new AbortController()
	const result = connectWallet(config, config.connectors[0], controller.signal).catch((error: Error) => error)
	await vi.waitFor(() => expect(listener).toBeTypeOf('function'))
	if (opensLate) controller.abort()
	finishOpening()
	if (!opensLate) {
		await vi.waitUntil(() => open)
		controller.abort()
	}
	expect(await result).toMatchObject({ message: 'Pairing cancelled' })
	expect(open).toBe(false)
	expect(listener).toBeUndefined()
})
