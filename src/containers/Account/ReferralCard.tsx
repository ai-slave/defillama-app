import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { FEATURES_SERVER } from '~/constants'
import { Button } from '~/ui/Button'
import { focusRegionOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Skeleton } from '~/ui/Skeleton'
import { Tooltip } from '~/ui/Tooltip'
import { handleSimpleFetchResponse } from '~/utils/async'

interface ReferralStats {
	referralsCount: number
	paidReferralsCount: number
}

export function ReferralCard() {
	const { user, isAuthenticated, authorizedFetch } = useAuthContext()
	const [copied, setCopied] = useState(false)

	const referralCode = user?.referral_code

	const {
		data: stats,
		isLoading: isStatsLoading,
		isError: isStatsError,
		isFetching: isStatsFetching,
		refetch: refetchStats
	} = useQuery<ReferralStats>({
		queryKey: ['referral-stats', user?.id],
		queryFn: async () => {
			const data = await authorizedFetch(`${FEATURES_SERVER}/user/referral-stats`, {
				method: 'GET'
			})
				.then(handleSimpleFetchResponse)
				.then((res) => res.json())

			return data
		},
		enabled: isAuthenticated && Boolean(referralCode),
		staleTime: 1000 * 60 * 5,
		refetchOnWindowFocus: false
	})

	if (!referralCode) return null

	const referralLink = `https://defillama.com/subscription?ref=${referralCode}`
	const refParam = `?ref=${referralCode}`

	const handleCopy = () => {
		navigator.clipboard.writeText(referralLink)
		setCopied(true)
		toast.success('Referral link copied to clipboard')
		setTimeout(() => setCopied(false), 2000)
	}

	const handleCopyRefParam = () => {
		navigator.clipboard.writeText(refParam)
		toast.success('Referral code copied to clipboard')
	}

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
			<div className="flex items-center gap-2">
				<Icon name="share" height={28} width={28} className="text-sub-text-primary" />
				<span className="label-lg text-sub-text-primary">Referrals</span>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<span className="body-md text-sub-text-primary">Your referral link</span>
					<Button variant="secondary" size="sm" onClick={handleCopy}>
						<Icon name="copy" className="size-3.5" />
						{copied ? 'Copied' : 'Copy'}
					</Button>
				</div>
				<div className="rounded-lg bg-sub-surface-panel px-3 py-2.5 dark:bg-sub-dark-page">
					<code className="mono-sm break-all text-sub-text-primary">{referralLink}</code>
				</div>
				<p className="body-sm text-sub-text-primary">
					Share this link to refer new users. You can also add{' '}
					{/* The ref param is a code value, so it keeps the mono face inside the link. */}
					<Tooltip content="Copy to clipboard" render={<Button variant="link" onClick={handleCopyRefParam} />}>
						<code className="mono-sm">{refParam}</code>
					</Tooltip>{' '}
					to any DefiLlama page link you share.
				</p>
			</div>

			<div className="flex flex-col gap-3 rounded-lg bg-sub-surface-panel p-3 dark:bg-sub-dark-page">
				{/* A failed lookup must not read as zero referrals; keep previously loaded stats visible. */}
				{isStatsError && stats == null ? (
					<div className="flex items-center justify-between gap-2">
						<span className="body-sm text-sub-text-primary">Couldn't load referral stats.</span>
						<Button
							variant="secondary"
							size="sm"
							ref={focusRegionOnLeave}
							onClick={() => void refetchStats()}
							pendingLabel={isStatsFetching ? 'Retrying…' : null}
						>
							Try again
						</Button>
					</div>
				) : (
					<>
						<div className="flex items-center justify-between">
							<span className="body-sm text-sub-text-primary">Sign-ups</span>
							{isStatsLoading ? (
								<Skeleton className="h-4 w-8" />
							) : (
								<span className="label-sm text-sub-text-primary">{stats?.referralsCount ?? 0}</span>
							)}
						</div>
						<div className="flex items-center justify-between">
							<span className="body-sm text-sub-text-primary">Paid subscriptions</span>
							{isStatsLoading ? (
								<Skeleton className="h-4 w-8" />
							) : (
								<span className="label-sm text-sub-text-primary">{stats?.paidReferralsCount ?? 0}</span>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	)
}
