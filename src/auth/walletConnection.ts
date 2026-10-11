import type EthereumProvider from '@walletconnect/ethereum-provider'
import type { Config, Connector } from 'wagmi'
import { connect } from 'wagmi/actions'

export async function connectWallet(config: Config, connector: Connector, signal: AbortSignal) {
	if (connector.type !== 'walletConnect') return connect(config, { connector })
	const provider = (await connector.getProvider()) as EthereumProvider
	if (signal.aborted) return null
	const closeModal = () => {
		void provider.modal?.close()
	}
	// The SDK owns the pairing UI. Leaving our sheet must also dismiss that UI,
	// including a modal that finishes opening after the attempt was canceled.
	const unsubscribe = provider.modal?.subscribeState(({ open }: { open: boolean }) => {
		if (open && signal.aborted) closeModal()
	})
	signal.addEventListener('abort', closeModal, { once: true })
	try {
		return await connect(config, { connector })
	} finally {
		signal.removeEventListener('abort', closeModal)
		unsubscribe?.()
	}
}
