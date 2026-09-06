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
			announcementId="defillama-mobile-app"
			version="2026-08-03"
			className="relative overflow-hidden border border-[#1a5cc4] bg-[linear-gradient(100deg,#1f67d2_0%,#2b7de9_45%,#4f9cf9_100%)] text-white shadow-[0_10px_30px_rgba(31,103,210,0.35)] dark:border-[#3d7fe0] dark:bg-[linear-gradient(100deg,#0d2a5c_0%,#154189_50%,#1d5cb8_100%)] dark:text-[#eaf3ff] dark:shadow-[0_10px_30px_rgba(13,42,92,0.5)]"
			contentClassName="text-center"
		>
			<span className="pointer-events-none absolute inset-y-0 -right-1/2 -left-1/2 animate-[shimmer_6s_ease-in-out_infinite] bg-[linear-gradient(99.97deg,transparent,rgba(255,255,255,0.18),transparent)]" />
			<span className="relative flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tracking-wide text-[#1f67d2] shadow-sm dark:bg-white/15 dark:text-white dark:ring-1 dark:ring-white/25">
					<Icon name="sparkles" height={12} width={12} />
					NEW APP
				</span>
				<span className="font-medium">The DefiLlama App is here.</span>
				<BasicLink
					href="/app"
					data-umami-event="mobile-app-announcement-click"
					className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white ring-1 ring-white/40 transition-colors hover:bg-white/25 dark:bg-white/10 dark:ring-white/30 dark:hover:bg-white/20"
				>
					Get extra free LlamaAI queries
					<Icon name="arrow-right" height={12} width={12} />
				</BasicLink>
			</span>
		</Announcement>
	)
}
