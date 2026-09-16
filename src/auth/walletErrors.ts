import { BaseError, ResourceUnavailableRpcError, TimeoutError, UserRejectedRequestError } from 'viem'
import { ProviderNotFoundError } from 'wagmi'

export function isWalletRequestRejected(error: Error) {
	return error instanceof BaseError
		? Boolean(error.walk((cause) => cause instanceof UserRejectedRequestError))
		: 'code' in error && error.code === 4001
}

export function walletErrorMessage(error: Error) {
	if (isWalletRequestRejected(error)) return 'Signature declined. No sign-in was completed.'
	if (error instanceof BaseError && error.walk((cause) => cause instanceof ResourceUnavailableRpcError))
		return 'A request is already open in your wallet. Open the wallet to finish or dismiss it.'
	if (
		error instanceof ProviderNotFoundError ||
		(error instanceof BaseError && error.walk((cause) => cause instanceof ProviderNotFoundError))
	)
		return 'This wallet is unavailable in this browser. Open its app or choose another wallet.'
	if (error instanceof BaseError && error.walk((cause) => cause instanceof TimeoutError))
		return 'The wallet did not respond in time. Check it for a pending request before trying again.'
	if (error instanceof TypeError) return 'Could not connect to your wallet. Check your connection.'
	return 'Your wallet did not complete the request. Try again or choose another wallet.'
}
