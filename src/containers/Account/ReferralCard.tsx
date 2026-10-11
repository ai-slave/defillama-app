import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { FEATURES_SERVER } from '~/constants'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { Skeleton } from '~/ui/Skeleton'
import { InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { handleSimpleFetchResponse } from '~/utils/async'
import { queryReadFailed } from '~/utils/query'

interface ReferralStats {
	referralsCount: number
	paidReferralsCount: number
}

export function ReferralCard() {
	const { user, isAuthenticated, authorizedFetch } = useAuthContext()
	const [copied, setCopied] = useState(false)

	const referralCode = user?.referral_code

	const statsQuery = useQuery<ReferralStats>({
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

	const stats = statsQuery.data

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
		<Card padding="md" className="flex flex-col gap-4">
			<div className="flex items-center gap-2">
				<Icon name="share" className="size-7 text-primary" />
				<span className="label-lg text-primary">Referrals</span>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<span className="body-md text-primary">Your referral link</span>
					<Button variant="secondary" size="sm" onClick={handleCopy} doneLabel="Copied" done={copied}>
						<Icon name="copy" className="size-3.5" />
						Copy
					</Button>
				</div>
				<div className="rounded-lg bg-surface-elevated-1 px-3 py-2.5">
					<code className="mono-sm break-all text-primary">{referralLink}</code>
				</div>
				<p className="body-sm text-primary">
					Share this link to refer new users. You can also add{' '}
					{/* The ref param is a code value, so it keeps the mono face inside the link. */}
					<Tooltip content="Copy to clipboard" render={<Button variant="link" onClick={handleCopyRefParam} />}>
						<code className="mono-sm">{refParam}</code>
					</Tooltip>{' '}
					to any DefiLlama page link you share.
				</p>
			</div>

			{/* A failed lookup must not read as zero referrals; keep previously loaded stats visible. */}
			{queryReadFailed(statsQuery) ? (
				<InlineStatus variant="error" retry={statsQuery}>
					Couldn't load referral stats.
				</InlineStatus>
			) : (
				<div className="flex flex-col gap-3 rounded-lg bg-surface-elevated-1 p-3">
					<div className="flex items-center justify-between">
						<span className="body-sm text-primary">Sign-ups</span>
						{statsQuery.isLoading ? (
							<Skeleton className="h-4 w-8" />
						) : (
							<span className="label-sm text-primary">{stats?.referralsCount ?? 0}</span>
						)}
					</div>
					<div className="flex items-center justify-between">
						<span className="body-sm text-primary">Paid subscriptions</span>
						{statsQuery.isLoading ? (
							<Skeleton className="h-4 w-8" />
						) : (
							<span className="label-sm text-primary">{stats?.paidReferralsCount ?? 0}</span>
						)}
					</div>
				</div>
			)}
		</Card>
	)
}
