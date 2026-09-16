import type { ReactNode } from 'react'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { mainnet, optimism } from 'wagmi/chains'
import { coinbaseWallet, injected, metaMask, walletConnect } from 'wagmi/connectors'

export const walletConfig = createConfig({
	chains: [mainnet, optimism],
	connectors: [
		metaMask({ dapp: { name: 'DefiLlama', url: 'https://defillama.com' } }),
		coinbaseWallet({
			appName: 'DefiLlama',
			appLogoUrl: 'https://defillama.com/assets/logo_white.webp',
			preference: { options: 'eoaOnly' }
		}),
		walletConnect({
			projectId: 'abcbcfd99b02bb0d7057fc19b2f8a2ad',
			showQrModal: true,
			metadata: {
				name: 'DefiLlama',
				description: 'Sign in to DefiLlama',
				url: 'https://defillama.com',
				icons: ['https://defillama.com/assets/logo_white.webp']
			}
		}),
		...(typeof window !== 'undefined' && 'ethereum' in window ? [injected()] : [])
	],
	transports: { [mainnet.id]: http(), [optimism.id]: http() },
	// This provider only mounts inside the client-only wallet screen. Preserve its in-memory
	// connection across opens without hydrating a second set of discovered wallets.
	storage: null
})

export function WalletProviderClient({ children }: { children: ReactNode }) {
	return (
		<WagmiProvider config={walletConfig} reconnectOnMount={false}>
			{children}
		</WagmiProvider>
	)
}
