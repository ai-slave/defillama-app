import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { FEATURES_SERVER } from '~/constants'
import { Icon } from '~/ui/Icon'
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
				<span className="text-base leading-5 font-medium text-sub-text-primary">Referrals</span>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<span className="text-sm text-sub-text-primary">Your Referral Link</span>
					<button
						type="button"
						onClick={handleCopy}
						className="flex h-6 items-center gap-1 rounded-md border border-sub-border-muted px-2 text-[10px] leading-3 font-medium text-sub-text-primary dark:border-sub-border-strong"
					>
						<Icon name="copy" height={12} width={12} />
						{copied ? 'Copied' : 'Copy'}
					</button>
				</div>
				<div className="rounded-lg bg-sub-surface-panel px-3 py-2.5 dark:bg-sub-dark-page">
					<code className="font-mono text-xs leading-5 break-all text-sub-text-primary">{referralLink}</code>
				</div>
				<p className="text-xs leading-4 text-sub-text-primary">
					Share this link to refer new users. You can also add{' '}
					<button
						type="button"
						onClick={handleCopyRefParam}
						title="Copy to clipboard"
						className="cursor-pointer font-mono underline decoration-dotted underline-offset-2 hover:text-sub-brand-primary"
					>
						{refParam}
					</button>{' '}
					to any DefiLlama page link you share.
				</p>
			</div>

			<div className="flex flex-col gap-3 rounded-lg bg-sub-surface-panel p-3 dark:bg-sub-dark-page">
				{/* A failed lookup must not read as zero referrals; keep previously loaded stats visible. */}
				{isStatsError && stats == null ? (
					<div className="flex items-center justify-between">
						<span className="text-xs text-sub-text-primary">Couldn't load referral stats.</span>
						<button
							type="button"
							onClick={() => refetchStats()}
							className="text-xs font-medium text-sub-text-primary underline decoration-dotted underline-offset-2 hover:text-sub-brand-primary"
						>
							Retry
						</button>
					</div>
				) : (
					<>
						<div className="flex items-center justify-between">
							<span className="text-xs text-sub-text-primary">Sign-ups</span>
							{isStatsLoading ? (
								<div className="h-4 w-8 animate-pulse rounded-sm bg-sub-border-light dark:bg-sub-border-strong" />
							) : (
								<span className="text-xs font-medium text-sub-text-primary">{stats?.referralsCount ?? 0}</span>
							)}
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs text-sub-text-primary">Paid Subscriptions</span>
							{isStatsLoading ? (
								<div className="h-4 w-8 animate-pulse rounded-sm bg-sub-border-light dark:bg-sub-border-strong" />
							) : (
								<span className="text-xs font-medium text-sub-text-primary">{stats?.paidReferralsCount ?? 0}</span>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	)
}
