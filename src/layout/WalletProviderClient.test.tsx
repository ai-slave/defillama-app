// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { useConnection, useConnectors } from 'wagmi'
import { connect } from 'wagmi/actions'
import { walletConfig, WalletProviderClient } from './WalletProviderClient'

// Keep discovery/hydration real, without starting third-party relay sessions in this test.
vi.mock('wagmi/connectors', async (importOriginal) => {
	const { mock, injected } = await importOriginal<typeof import('wagmi/connectors')>()
	const fixture = () => mock({ accounts: ['0x1111111111111111111111111111111111111111'] })
	return { metaMask: fixture, coinbaseWallet: fixture, walletConnect: fixture, injected }
})

test('reopening discovers each wallet once and preserves an explicitly connected wallet', async () => {
	const address = '0x1111111111111111111111111111111111111111'
	const provider = {
		on: vi.fn(),
		removeListener: vi.fn(),
		request: vi.fn(async ({ method }: { method: string }) => (method === 'eth_chainId' ? '0x1' : [address]))
	}
	window.dispatchEvent(
		new CustomEvent('eip6963:announceProvider', {
			detail: {
				info: {
					uuid: '20ba94b5-197b-462b-8373-cd3a4d1b0b7b',
					name: 'Discovered wallet',
					rdns: 'io.fixture.wallet',
					icon: 'data:image/png;base64,AA=='
				},
				provider
			}
		})
	)
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const queryClient = new QueryClient()
	function Consumer() {
		const connectors = useConnectors()
		const connection = useConnection()
		return (
			<div>
				{connectors.map((connector) => (
					<span key={connector.uid}>{connector.name}</span>
				))}
				<p>{connection.address}</p>
			</div>
		)
	}
	const screen = (
		<QueryClientProvider client={queryClient}>
			<WalletProviderClient>
				<Consumer />
			</WalletProviderClient>
		</QueryClientProvider>
	)
	try {
		await act(async () => root.render(screen))
		await vi.waitFor(() => expect(container.textContent?.match(/Discovered wallet/g)).toHaveLength(1))
		await act(async () => {
			await connect(walletConfig, {
				connector: walletConfig.connectors.find((connector) => connector.name === 'Discovered wallet')!
			})
		})
		expect(container.textContent).toContain(address)
		await act(async () => root.render(null))
		await act(async () => root.render(screen))
		expect(container.textContent?.match(/Discovered wallet/g)).toHaveLength(1)
		expect(container.textContent).toContain(address)
	} finally {
		await act(async () => root.unmount())
		container.remove()
		queryClient.clear()
	}
})
