import { useAuthContext } from '~/auth'
import { Announcement } from '~/components/Announcement'
import { TokenLogo } from '~/components/TokenLogo'
import { slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { TargetedAnnouncement } from '../Announcements/TargetedAnnouncement'
import { getMainSiteIrDashboard } from '../Investors/mainSiteDashboards'

const NEAR_CHAIN_ICON = chainIconUrl('near')

export function ChainOverviewAnnouncement({ chainName }: { chainName?: string }) {
	const { user } = useAuthContext()
	const normalizedChainName = chainName?.toLowerCase()
	const showsInPageIr = !!chainName && !!getMainSiteIrDashboard('chain', slug(chainName))

	if (normalizedChainName === 'near') {
		if (showsInPageIr) return null
		return (
			<Announcement
				announcementId="near-investor-relations"
				version="2026-05-26-2"
				className="border border-near-announcement-border bg-(image:--near-announcement-bg) text-near-announcement-text shadow-near-announcement"
				contentClassName="text-center"
			>
				<span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
					<span className="inline-flex items-center gap-1.5 rounded-full border border-near-announcement-badge-border bg-near-announcement-badge-bg px-2 py-0.5 title-sm text-near-announcement-badge-text">
						<TokenLogo src={NEAR_CHAIN_ICON} size={14} alt="Logo of NEAR" />
						NEAR IR
					</span>
					<span>View NEAR&apos;s</span>
					<a
						href={`https://investors.defillama.com/near${user?.id ? `?referrer=${user.id}` : ''}`}
						target="_blank"
						rel="noopener noreferrer"
						className="underline decoration-2 underline-offset-[3px]"
					>
						investor relations dashboard
					</a>
					<span className="opacity-90">for deeper analytics and investor reports.</span>
				</span>
			</Announcement>
		)
	}

	if (chainName === 'Sonic') {
		if (showsInPageIr) return null
		return (
			<Announcement
				announcementId="sonic-investor-relations"
				version="2026-04-23"
				className="border border-sonic-announcement-border bg-(image:--sonic-announcement-bg) text-sonic-announcement-text shadow-sonic-announcement"
				contentClassName="text-center"
			>
				<span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
					<span className="inline-flex items-center gap-1.5 rounded-full border border-announcement-chip-border bg-announcement-chip-bg px-2 py-0.5 title-sm text-sonic-announcement-badge-text">
						<TokenLogo name="Sonic" kind="chain" size={14} alt="Logo of Sonic" />
						Sonic IR
					</span>
					<span>View Sonic&apos;s</span>
					<a
						href={`https://investors.defillama.com/sonic${user?.id ? `?referrer=${user.id}` : ''}`}
						target="_blank"
						rel="noopener noreferrer"
						className="underline decoration-2 underline-offset-[3px]"
					>
						investor relations dashboard
					</a>
					<span className="opacity-90">for deeper analytics and investor reports.</span>
				</span>
			</Announcement>
		)
	}

	return <TargetedAnnouncement />
}
