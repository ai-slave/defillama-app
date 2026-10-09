import { useMutation } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { type Connector, useConfig, useConnection, useConnectors } from 'wagmi'
import { disconnect, getConnection, signMessage, watchConnection } from 'wagmi/actions'
import { useAuthContext } from '~/auth'
import {
	LastUsedCorner,
	authWalletRowStyles,
	authProviderIconSlotStyles,
	authWalletPickerStyles
} from '~/auth/AuthDialog'
import { useLastSignIn } from '~/auth/lastSignIn'
import type { SignInFlowStore } from '~/auth/signInFlowStore'
import { signInWithWallet } from '~/auth/walletAuth'
import { connectWallet } from '~/auth/walletConnection'
import { isWalletRequestRejected, walletErrorMessage } from '~/auth/walletErrors'
import { WalletProviderClient } from '~/layout/WalletProviderClient'
import { Button } from '~/ui/Button'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'

export type WalletSignInProps = {
	store: SignInFlowStore
	onAuthenticated: () => void
}

const walletIcons: Record<string, string | undefined> = {
	metaMaskSDK: '/assets/wallets/metamask.svg',
	coinbaseWalletSDK: '/assets/wallets/coinbase.svg',
	walletConnect: '/assets/wallets/walletconnect.svg'
}

export function WalletSignIn(props: WalletSignInProps) {
	return (
		<WalletProviderClient>
			<WalletSignInForm {...props} />
		</WalletProviderClient>
	)
}

export function WalletSignInForm({ store, onAuthenticated }: WalletSignInProps) {
	const config = useConfig()
	const connection = useConnection()
	const connectors = useConnectors()
	const lastSignIn = useLastSignIn()
	const lastConnectorId = lastSignIn?.method === 'wallet' ? lastSignIn.connectorId : null
	const installed = connectors.filter((connector) => connector.type === 'injected' && connector.id !== 'injected')
	const available = [
		...installed,
		...connectors.filter(
			(connector) => connector.type !== 'injected' || (connector.id === 'injected' && installed.length === 0)
		)
	]
	available.sort((a, b) => Number(b.id === lastConnectorId) - Number(a.id === lastConnectorId))
	const { consumeSignupOutcome } = useAuthContext()
	const [selected, setSelected] = useState<Connector | null>(() =>
		connection.isConnected ? connection.connector : null
	)
	const [stage, setStage] = useState<'preparing' | 'signing' | 'authenticating'>('preparing')
	const errorId = useId()
	const [error, setError] = useState('')
	const connectMutation = useMutation({
		mutationFn: ({ connector, signal }: { connector: Connector; signal: AbortSignal }) =>
			connectWallet(config, connector, signal)
	})
	const disconnectMutation = useMutation({ mutationFn: (connector: Connector) => disconnect(config, { connector }) })
	const signInMutation = useMutation({ mutationFn: signInWithWallet })
	const reviewing =
		selected !== null &&
		selected.uid === connection.connector?.uid &&
		connection.isConnected &&
		!connectMutation.isPending
	const busy = connectMutation.isPending || disconnectMutation.isPending || signInMutation.isPending
	const reviewIcon = connection.connector ? (connection.connector.icon ?? walletIcons[connection.connector.id]) : null

	useEffect(() => store.cancelAuthRequest, [store])

	async function chooseWallet(connector: Connector) {
		if (busy) return
		setError('')
		setSelected(connector)
		const signal = store.beginAuthRequest()
		const alreadyConnected = getConnection(config).connector?.uid === connector.uid
		try {
			if (!alreadyConnected) await connectMutation.mutateAsync({ connector, signal })
		} catch (caughtError) {
			if (!signal.aborted && !isWalletRequestRejected(caughtError as Error))
				setError(walletErrorMessage(caughtError as Error))
		}
	}

	async function submit() {
		if (busy || !reviewing || !connection.address || !connection.connector) return
		setError('')
		setStage('preparing')
		const { address, chainId, connector } = connection
		const signal = store.beginAuthRequest()
		const sameWallet = () => {
			const current = getConnection(config)
			return current.address === address && current.chainId === chainId && current.connector?.uid === connector.uid
		}
		// Any change aborts the request, so switching away and back before it finishes still invalidates it.
		const stopWatching = watchConnection(config, {
			onChange: () => {
				if (!sameWallet() && !signal.aborted) {
					store.cancelAuthRequest()
					signInMutation.reset()
					setError('Your wallet changed. Review the address before signing in.')
				}
			}
		})
		signal.addEventListener('abort', stopWatching, { once: true })
		try {
			await signInMutation.mutateAsync({
				address,
				connectorId: connector.id,
				signal,
				signMessage: async (message) => {
					try {
						return await signMessage(config, { message, account: address, connector })
					} catch (caughtError) {
						throw new Error(walletErrorMessage(caughtError as Error), { cause: caughtError })
					}
				},
				onStage: setStage,
				onAuthenticated: () => {
					consumeSignupOutcome()
					onAuthenticated()
				}
			})
		} catch (caughtError) {
			// Signature errors are translated above; keep the server's account-specific explanation.
			if (!signal.aborted)
				setError(
					caughtError instanceof TypeError
						? 'Could not reach the sign-in service. Check your connection.'
						: (caughtError as Error).message
				)
		}
		signal.removeEventListener('abort', stopWatching)
		stopWatching()
	}

	async function changeWallet() {
		store.cancelAuthRequest()
		signInMutation.reset()
		setError('')
		if (connection.connector) {
			try {
				await disconnectMutation.mutateAsync(connection.connector)
			} catch (caughtError) {
				setError(walletErrorMessage(caughtError as Error))
				return
			}
		}
		setSelected(null)
	}

	const errorStatus = error ? (
		<div id={errorId}>
			<InlineStatus variant="error">{error}</InlineStatus>
		</div>
	) : null

	return (
		<div className={`flex flex-col gap-4 ${reviewing ? '' : authWalletPickerStyles}`}>
			{reviewing ? (
				<>
					<div className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface-elevated-1 p-3">
						<div className="flex items-center gap-2">
							{reviewIcon ? <img src={reviewIcon} alt="" className="size-6 shrink-0 rounded-sm" /> : null}
							<p className="min-w-0 flex-1 truncate label-md text-primary">{connection.connector?.name}</p>
							<Button
								type="button"
								size="sm"
								disabled={signInMutation.isPending}
								pendingLabel="Disconnecting…"
								pending={disconnectMutation.isPending}
								onClick={() => void changeWallet()}
							>
								Disconnect
							</Button>
						</div>
						<p className="mono-sm text-balance break-all text-secondary">{connection.address}</p>
					</div>
					<p className="body-sm text-secondary">
						Sign a free message to prove you own this wallet. No transaction, gas fee or network switch.
					</p>
					{/* The review replaces the wait for the wallet, so its next step takes focus when it appears. */}
					<Button
						autoFocus
						type="button"
						variant="primary"
						size="md"
						className="w-full"
						disabled={connectMutation.isPending || disconnectMutation.isPending}
						aria-describedby={error ? errorId : undefined}
						pendingLabel={
							stage === 'preparing'
								? 'Preparing sign-in…'
								: stage === 'signing'
									? `Waiting for ${connection.connector?.name ?? 'your wallet'}…`
									: 'Signing in…'
						}
						pending={signInMutation.isPending}
						onClick={() => void submit()}
					>
						Sign in
					</Button>
					{errorStatus}
				</>
			) : (
				<>
					<p className="body-sm text-secondary">Use a wallet already linked to your account.</p>
					{disconnectMutation.isSuccess ? (
						<p className="body-sm text-secondary">
							To switch addresses, choose another account in your wallet before reconnecting. Reconnecting alone may
							return the same address.
						</p>
					) : null}
					{selected && connectMutation.isPending ? (
						// Keyed apart from the list, so the two never share a node that focus could stay on.
						<div key="waiting" role="status" aria-live="polite" className="flex flex-col gap-1">
							<LoadingIndicator label={`Waiting for ${selected.name}`} />
							<p className="body-sm text-secondary">
								Approve the connection in your wallet. Connecting won’t sign you in.
							</p>
						</div>
					) : (
						<div role="group" aria-label="Wallets" className="flex flex-col gap-3">
							{available.map((connector) => {
								const icon = connector.icon ?? walletIcons[connector.id]
								return (
									<button
										key={connector.uid}
										type="button"
										disabled={busy}
										className={authWalletRowStyles}
										onClick={() => void chooseWallet(connector)}
									>
										<span className={authProviderIconSlotStyles} aria-hidden>
											{icon ? <img src={icon} alt="" className="size-5 rounded-sm" /> : null}
										</span>
										<span className="min-w-0 flex-1 truncate" title={connector.name}>
											{connector.id === 'injected' ? 'Browser wallet' : connector.name}
										</span>
										<span className="flex shrink-0 items-center gap-2">
											{connector.type === 'injected' ? <span className="label-xs text-tertiary">Installed</span> : null}
											{connector.id === lastConnectorId ? <LastUsedCorner /> : null}
										</span>
									</button>
								)
							})}
						</div>
					)}
					{errorStatus}
				</>
			)}
		</div>
	)
}
