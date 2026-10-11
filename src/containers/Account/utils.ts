import type { QueryClient } from '@tanstack/react-query'

const WALLET_EMAIL_SUFFIX = '@defillama.com'
const WALLET_EMAIL_LENGTH = 56 // 42 (0x + 40 hex chars) + 14 (@defillama.com)

export function isWalletEmail(email: string | undefined | null): boolean {
	return !!email && email.endsWith(WALLET_EMAIL_SUFFIX) && email.length === WALLET_EMAIL_LENGTH
}

export function truncateAddress(address: string): string {
	return `${address.slice(0, 6)}…${address.slice(-6)}`
}

// A checkout return lands before the webhook applies the purchase, so re-read the affected data a bounded number of
// times instead of announcing the result as already applied.
export function scheduleConfirmationReads(queryClient: QueryClient, queryKey: Array<string>) {
	void queryClient.invalidateQueries({ queryKey })
	for (const delay of [4000, 12_000]) {
		window.setTimeout(() => void queryClient.invalidateQueries({ queryKey }), delay)
	}
}
