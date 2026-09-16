import PocketBase, { BaseAuthStore, type RecordAuthResponse } from 'pocketbase'
import type { Address, Hex } from 'viem'
import { createSiweMessage } from 'viem/siwe'
import { getAuthErrorMessageFromResponse } from '~/auth/authErrors'
import { acceptAuthSession, type AuthRequest } from '~/auth/authRequest'
import { rememberSignIn } from '~/auth/lastSignIn'
import { getReferrer } from '~/auth/referrer'
import { clearSignupSource, getSignupSource } from '~/auth/signupSource'
import { AUTH_SERVER, POCKETBASE_URL } from '~/constants'

export type WalletAuthRequest = AuthRequest & {
	address: Address
	connectorId: string
	signMessage: (message: string) => Promise<Hex>
	onStage: (stage: 'preparing' | 'signing' | 'authenticating') => void
}

export async function signInWithWallet(request: WalletAuthRequest) {
	const { address, signal, signMessage, onStage } = request
	const client = new PocketBase(POCKETBASE_URL, new BaseAuthStore())
	return acceptAuthSession(
		request,
		async (isCurrent) => {
			onStage('preparing')
			// The CDN currently caches this single-use nonce even with a no-store request.
			// A distinct URL per attempt also bypasses previously cached, consumed nonces.
			const nonceResponse = await fetch(`${AUTH_SERVER}/nonce?address=${address}&requestId=${crypto.randomUUID()}`, {
				signal,
				cache: 'no-store'
			})
			if (!nonceResponse.ok)
				throw new Error(await getAuthErrorMessageFromResponse(nonceResponse, 'Could not prepare wallet sign-in.'))
			const { nonce } = (await nonceResponse.json()) as { nonce: string }
			if (!isCurrent()) throw new Error('Your wallet changed. Review it before signing in.')
			const issuedAt = new Date()
			// The server reconstructs this exact chain-1 message, independently of the wallet's current network.
			const message = createSiweMessage({
				domain: window.location.host,
				address,
				statement: 'Sign in with Ethereum to the app.',
				uri: window.location.origin,
				version: '1',
				chainId: 1,
				nonce,
				issuedAt
			})
			onStage('signing')
			const signature = await signMessage(message)
			if (!isCurrent()) throw new Error('Your wallet changed. Review it before signing in.')
			onStage('authenticating')
			const response = await fetch(`${AUTH_SERVER}/eth-auth`, {
				method: 'POST',
				signal,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message,
					signature,
					address,
					issuedAt: issuedAt.toISOString(),
					source: getSignupSource(),
					referrer: getReferrer()
				})
			})
			if (!response.ok)
				throw new Error(await getAuthErrorMessageFromResponse(response, 'Could not sign in with this wallet.'))
			const { identity, password, impersonate } = (await response.json()) as {
				identity: string
				password: string
				impersonate?: RecordAuthResponse
			}
			if (!isCurrent()) throw new Error('Your wallet changed. Review it before signing in.')
			if (impersonate) return impersonate
			// Legacy wallet accounts use a one-time password. The SDK's early store write stays private.
			return client.collection('users').authWithPassword(identity, password, { signal, requestKey: null })
		},
		() => {
			clearSignupSource()
			rememberSignIn({ method: 'wallet', connectorId: request.connectorId })
		}
	)
}
