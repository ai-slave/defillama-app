import { useAuthContext } from '~/auth'
import { Announcement } from '~/components/Announcement'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
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
				className="border border-[#111827] bg-[linear-gradient(90deg,rgba(255,255,255,0.98),rgba(232,255,244,0.98)_42%,rgba(216,243,235,0.95)_100%)] text-[#111827] shadow-[0_8px_20px_rgba(0,236,151,0.13)] dark:border-[#38f5a6] dark:bg-[linear-gradient(90deg,rgba(13,18,17,0.96),rgba(17,44,33,0.94)_55%,rgba(10,61,50,0.94)_100%)] dark:text-[#d9fff0]"
				contentClassName="text-center"
			>
				<span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
					<span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-xs font-semibold text-[#111827] shadow-sm dark:border-[#38f5a6]/30 dark:bg-white/12 dark:text-[#b6ffd8]">
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
				className="border border-[#7aa8ff] bg-[linear-gradient(90deg,rgba(234,242,255,0.98),rgba(213,229,255,0.98)_38%,rgba(219,225,255,0.95)_100%)] text-[#0c3d7a] shadow-[0_8px_20px_rgba(43,108,255,0.14)] dark:border-[#1e528f] dark:bg-[linear-gradient(90deg,rgba(27,43,66,0.96),rgba(33,55,81,0.94)_55%,rgba(26,40,94,0.94)_100%)] dark:text-[#d5e3ff]"
				contentClassName="text-center"
			>
				<span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
					<span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/70 px-2 py-0.5 text-xs font-semibold text-[#124c8d] shadow-sm dark:border-white/10 dark:bg-white/12 dark:text-[#aac7ff]">
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

	return (
		<Announcement
			announcementId="universal-token-rating"
			version="2026-09-18"
			className="relative overflow-hidden border border-[#9ad9bb] bg-[linear-gradient(100deg,#eafaf1_0%,#d9f4e6_55%,#c9efdb_100%)] text-[#0b4d33] shadow-[0_10px_30px_rgba(17,147,95,0.18)] dark:border-[#1f6a48] dark:bg-[linear-gradient(100deg,#0d3324_0%,#12452f_55%,#155238_100%)] dark:text-[#cdf5e0] dark:shadow-[0_10px_30px_rgba(13,51,36,0.5)]"
			contentClassName="text-center"
			dismissButtonClassName="hover:bg-[#0b4d33]/10 dark:hover:bg-white/10"
		>
			<span className="pointer-events-none absolute inset-y-0 -right-1/2 -left-1/2 animate-[shimmer_6s_ease-in-out_infinite] bg-[linear-gradient(99.97deg,transparent,rgba(255,255,255,0.35),transparent)] dark:bg-[linear-gradient(99.97deg,transparent,rgba(141,242,192,0.12),transparent)]" />
			<span className="relative flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-[#0e7a4f] px-2.5 py-0.5 text-xs font-bold tracking-wide text-white shadow-sm dark:bg-[#1f5a40] dark:text-[#8df2c0] dark:ring-1 dark:ring-[#8df2c0]/30">
					<Icon name="sparkles" height={12} width={12} />
					NEW
				</span>
				<span className="font-medium">Universal Token Rating is live: data-driven scores for every token.</span>
				<BasicLink
					href="/universal-token-rating"
					data-umami-event="utr-announcement-click"
					className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-semibold text-[#0b4d33] ring-1 ring-[#0e7a4f]/40 transition-colors hover:bg-white dark:bg-white/10 dark:text-[#cdf5e0] dark:ring-[#8df2c0]/30 dark:hover:bg-white/20"
				>
					See the ratings
					<Icon name="arrow-right" height={12} width={12} />
				</BasicLink>
			</span>
		</Announcement>
	)
}
