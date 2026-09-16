import type * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { type Connector, useConfig, useConnection, useConnectors } from 'wagmi'
import { disconnect, getConnection, signMessage, watchConnection } from 'wagmi/actions'
import { useAuthContext } from '~/auth'
import { LastUsedChip, authPrimaryButtonStyles, authWalletPickerStyles } from '~/auth/AuthDialog'
import { useLastSignIn } from '~/auth/lastSignIn'
import type { SignInFlowStore } from '~/auth/signInFlowStore'
import { signInWithWallet } from '~/auth/walletAuth'
import { connectWallet } from '~/auth/walletConnection'
import { isWalletRequestRejected, walletErrorMessage } from '~/auth/walletErrors'
import { WalletProviderClient } from '~/layout/WalletProviderClient'

export type WalletSignInProps = {
	dialogStore: Ariakit.DialogStore
	store: SignInFlowStore
	onAuthenticated: () => void
}

const primaryClass = authPrimaryButtonStyles
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

export function WalletSignInForm({ dialogStore, store, onAuthenticated }: WalletSignInProps) {
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
		// Remember any change, including switching away and back before the request finishes.
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
				canAccept: () => dialogStore.getState().open && sameWallet(),
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

	return (
		<div className={`flex flex-col gap-4 ${reviewing ? '' : authWalletPickerStyles}`}>
			{reviewing ? (
				<>
					<div className="rounded-lg border border-medium p-3 text-sm text-primary">
						<p className="mb-1 font-medium">{connection.connector?.name}</p>
						<p className="font-mono text-xs break-all">{connection.address}</p>
					</div>
					<p className="text-xs text-secondary">Sign a message to sign in. No transaction or gas fee.</p>
					{connection.chainId !== 1 ? (
						<p className="text-xs text-secondary">The message identifies Ethereum; no network switch is needed.</p>
					) : null}
					<button
						type="button"
						className={primaryClass}
						disabled={busy}
						aria-describedby={error ? errorId : undefined}
						onClick={() => void submit()}
					>
						{signInMutation.isPending ? (
							<>
								<Spinner />
								{stage === 'preparing'
									? 'Preparing sign-in…'
									: stage === 'signing'
										? 'Approve in your wallet…'
										: 'Signing in…'}
							</>
						) : (
							'Sign in'
						)}
					</button>
					{error ? (
						<p id={errorId} role="alert" className="text-xs text-error">
							{error}
						</p>
					) : null}
					<button
						type="button"
						className="text-sm text-link"
						disabled={disconnectMutation.isPending}
						onClick={() => void changeWallet()}
					>
						{disconnectMutation.isPending ? 'Disconnecting…' : 'Change wallet'}
					</button>
					<p className="text-center text-xs text-secondary">Changing wallets disconnects this wallet from DefiLlama.</p>
				</>
			) : (
				<>
					<p className="text-xs text-secondary">Use a wallet already linked to your account.</p>
					{disconnectMutation.isSuccess ? (
						<p className="text-xs text-secondary">
							To switch addresses, choose another account in your wallet before reconnecting. Reconnecting alone may
							return the same address.
						</p>
					) : null}
					{selected && connectMutation.isPending ? (
						<>
							<p role="status" className="flex items-center gap-2 text-sm text-primary">
								<Spinner />
								Waiting for {selected.name}…
							</p>
							<p className="text-xs text-secondary">
								Approve the connection in your wallet. Connecting won’t sign you in.
							</p>
						</>
					) : (
						<div className="flex flex-col gap-2">
							{available.map((connector) => {
								const icon = connector.icon ?? walletIcons[connector.id]
								return (
									<button
										key={connector.uid}
										type="button"
										disabled={busy}
										className="flex min-h-11 items-center gap-2 rounded-lg border border-medium px-3 py-2 text-left text-sm text-primary disabled:opacity-50"
										onClick={() => void chooseWallet(connector)}
									>
										<span className="flex size-6 shrink-0 items-center justify-center" aria-hidden>
											{icon ? <img src={icon} alt="" className="size-6 rounded-sm" /> : null}
										</span>
										<span className="min-w-0 flex-1 truncate" title={connector.name}>
											{connector.id === 'injected' ? 'Browser wallet' : connector.name}
										</span>
										<span className="ml-auto flex shrink-0 items-center gap-1">
											{connector.type === 'injected' ? (
												<span className="rounded-full bg-brand-muted px-2 py-0.5 label-xs text-link-on-tint max-[380px]:px-1">
													Installed
												</span>
											) : null}
											{connector.id === lastConnectorId ? <LastUsedChip /> : null}
										</span>
									</button>
								)
							})}
						</div>
					)}
					{error ? (
						<p id={errorId} role="alert" className="text-xs text-error">
							{error}
						</p>
					) : null}
				</>
			)}
		</div>
	)
}

function Spinner() {
	return (
		<span
			aria-hidden
			className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
		/>
	)
}
