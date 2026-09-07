import type * as Ariakit from '@ariakit/react'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useCallback, useEffect, useRef } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useAuthContext } from '~/auth'
import { WalletProvider } from '~/layout/WalletProvider'

export type WalletSignInButtonProps = {
	dialogStore: Ariakit.DialogStore
	setError: (error: string) => void
	autoStart?: boolean
	onAuthenticated?: () => void
}

export function WalletSignInButton(props: WalletSignInButtonProps) {
	return (
		<WalletProvider>
			<WalletSignInButtonInner {...props} />
		</WalletProvider>
	)
}

function WalletSignInButtonInner({
	dialogStore,
	setError,
	autoStart = false,
	onAuthenticated
}: WalletSignInButtonProps) {
	const startedRef = useRef(false)
	const { signInWithEthereumMutation } = useAuthContext()
	const { openConnectModal } = useConnectModal()
	const { address } = useAccount()
	const { signMessageAsync } = useSignMessage()

	const handleWalletSignIn = useCallback(async () => {
		setError('')
		if (address) {
			// An optional call cannot be lowered inside a try. Kept as mutateAsync in the try rather than
			// moved to mutate callbacks, because setError belongs to the parent: a callback would stop
			// reporting the failure if this button unmounted mid-request, and the try does not.
			const notifyAuthenticated = () => onAuthenticated?.()
			try {
				await signInWithEthereumMutation.mutateAsync({ address, signMessageFunction: signMessageAsync })
				notifyAuthenticated()
				dialogStore.hide()
			} catch {
				setError('Failed to sign in with wallet')
			}
			return
		}

		openConnectModal?.()
	}, [address, dialogStore, onAuthenticated, openConnectModal, setError, signInWithEthereumMutation, signMessageAsync])

	useEffect(() => {
		if (!autoStart || startedRef.current) return
		startedRef.current = true
		void handleWalletSignIn()
	}, [autoStart, handleWalletSignIn])

	return (
		<button
			type="button"
			className="text-link"
			onClick={() => void handleWalletSignIn()}
			disabled={signInWithEthereumMutation.isPending}
		>
			{signInWithEthereumMutation.isPending ? 'Connecting...' : 'Sign-in here'}
		</button>
	)
}
