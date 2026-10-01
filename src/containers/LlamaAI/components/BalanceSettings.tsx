import { useEffect, useState } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import type { TopupResult } from '~/containers/LlamaAI/utils/settingsIntent'
import { TopupForm } from '~/containers/Subscription/shared/TopupModal'
import { useAiBalance } from '~/containers/Subscription/useTopup'
import { Button } from '~/ui/Button'
import { formatUsd } from '~/utils/numberFormat'

export function BalanceSettings({ result, balanceBefore }: { result?: TopupResult; balanceBefore?: number }) {
	const { hasActiveSubscription } = useAuthContext()
	const { balance, totalAvailable, isLoading, isError, refetch } = useAiBalance()
	// The balance the payment is measured against: the one at checkout start when the return URL carries it,
	// else the first read after return, which may already include the credit. That first read is memory, kept the
	// render it arrives in.
	const [firstRead, setFirstRead] = useState<number | null>(balance ? totalAvailable : null)
	if (result === 'success' && firstRead === null && balance) setFirstRead(totalAvailable)
	const baseline = balanceBefore ?? firstRead
	// The payment's outcome only moves forward: seeing the credit completes it for good, so credits spent later never
	// reopen it, and a late credit still completes a payment whose polls ran out.
	const [returnState, setReturnState] = useState<'pending' | 'exhausted' | 'updated' | 'hidden'>('pending')
	const credited = result === 'success' && !!balance && baseline !== null && totalAvailable > baseline
	if (credited && (returnState === 'pending' || returnState === 'exhausted')) setReturnState('updated')
	useEffect(() => {
		if (returnState !== 'updated') return
		const timer = window.setTimeout(() => setReturnState('hidden'), 5000)
		return () => window.clearTimeout(timer)
	}, [returnState])
	useEffect(() => {
		let active = true
		void refetch()
		if (result !== 'success') return
		const timers = [4000, 12_000].map((delay) =>
			window.setTimeout(async () => {
				await refetch()
				if (active && delay === 12_000) setReturnState((state) => (state === 'pending' ? 'exhausted' : state))
			}, delay)
		)
		return () => {
			active = false
			for (const timer of timers) window.clearTimeout(timer)
		}
	}, [refetch, result])

	const currentUrl = new URL(typeof window === 'undefined' ? '/ai/chat' : window.location.href, 'https://defillama.com')
	currentUrl.searchParams.set('modal', 'settings')
	currentUrl.searchParams.set('tab', 'balance')
	currentUrl.searchParams.set('topup', 'success')
	if (balance) currentUrl.searchParams.set('topup_from', String(totalAvailable))
	const redirectUrl = currentUrl.href
	currentUrl.searchParams.set('topup', 'cancelled')
	currentUrl.searchParams.delete('topup_from')
	return (
		<div className="space-y-6">
			<section aria-label="External data balance" className="space-y-3">
				<h2 className="heading-sm text-primary">External data balance</h2>
				<p className="body-sm text-secondary">
					Credits that let LlamaAI access premium external data sources like onchain data, X profiles, LinkedIn, and
					more.
				</p>
				<div className="flex min-h-7 items-center justify-between gap-3">
					{isLoading ? (
						<p role="status">Loading balance…</p>
					) : balance ? (
						<p className="text-xl font-semibold text-primary tabular-nums">
							{formatUsd(totalAvailable, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
						</p>
					) : null}
				</div>
				{result === 'cancelled' && !isError ? (
					<p role="status" className="body-sm text-secondary">
						Payment cancelled.
					</p>
				) : null}
				{isError || (result === 'success' && returnState !== 'hidden') ? (
					<div className="space-y-3 rounded-lg border border-subtle bg-brand-muted p-4">
						<div role={isError ? 'alert' : 'status'} className="space-y-1 body-sm">
							<p className="font-semibold text-primary">
								{isError
									? "Couldn't load your balance"
									: result === 'success'
										? returnState === 'updated'
											? 'Balance updated'
											: returnState === 'exhausted'
												? 'Still waiting for your balance to update'
												: 'Checking your payment'
										: 'Payment cancelled'}
							</p>
							<p className="text-secondary">
								{isError
									? 'Try refreshing your balance.'
									: result === 'success'
										? returnState === 'updated'
											? `Your current balance is ${formatUsd(totalAvailable, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
											: 'Your balance may take a moment to update.'
										: 'You can choose an amount and try again.'}
							</p>
						</div>
						{isError || returnState === 'exhausted' ? (
							<div className="flex flex-wrap items-center gap-3">
								{!isError ? <p className="body-sm text-secondary">Balance still unchanged?</p> : null}
								<Button type="button" variant="outline" size="md" onClick={() => void refetch()}>
									Refresh balance
								</Button>
							</div>
						) : null}
					</div>
				) : null}
			</section>
			{hasActiveSubscription ? (
				<section aria-label="Top up balance" className="space-y-4">
					<TopupForm inDialog={false} redirectUrl={redirectUrl} cancelUrl={currentUrl.href} />
				</section>
			) : (
				<p className="body-sm text-secondary">
					<BasicLink href="/subscription" className="text-link">
						Subscribe to a plan
					</BasicLink>{' '}
					to top up your external data balance.
				</p>
			)}
		</div>
	)
}
