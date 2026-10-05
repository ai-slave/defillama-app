import { Announcement, type AnnouncementTracking } from '~/components/Announcement'
import { BasicLink } from '~/components/Link'
import { WELCOME_WEEK_ALLOWANCE } from '~/containers/LlamaAI/freePlanCopy'

/** Shared with the announcement registry so the launch entry and the fallback dismiss together. */
export const LLAMAAI_PROMO_ANNOUNCEMENT = { id: 'llamaai-promo', version: '2026-10-02' } as const

/**
 * Cream with a deep gold badge and the header's gold Try LlamaAI pill in light, LlamaAI ink in dark. Gold fills only the
 * badge and the pill, so it reads apart from the all-gold Verified APY banner and the blue app one.
 */
export function LlamaAIPromoAnnouncement({ track }: { track: AnnouncementTracking }) {
	return (
		<Announcement
			announcementId={LLAMAAI_PROMO_ANNOUNCEMENT.id}
			version={LLAMAAI_PROMO_ANNOUNCEMENT.version}
			dismissTracking={track.dismiss}
			className="relative overflow-hidden border border-llamaai-announcement-border bg-(image:--llamaai-announcement-bg) text-llamaai-announcement-text shadow-llamaai-announcement"
			contentClassName="text-center"
			dismissButtonClassName="hover:bg-llamaai-announcement-dismiss"
		>
			<span className="pointer-events-none absolute inset-y-0 -right-1/2 -left-1/2 animate-[shimmer_6s_ease-in-out_infinite] bg-(image:--llamaai-announcement-shimmer)" />
			<span className="relative flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
				<span className="inline-flex items-center rounded-full bg-(image:--llamaai-announcement-badge-bg) px-2.5 py-0.5 title-sm tracking-wide text-llamaai-announcement-badge-text shadow-sm">
					✦ NEW
				</span>
				<span className="font-medium">{`Ask LlamaAI anything about DeFi — ${WELCOME_WEEK_ALLOWANCE}.`}</span>
				<BasicLink
					{...track.cta}
					href="/ai"
					className="inline-flex items-center rounded-full bg-llamaai-announcement-link px-2.5 py-0.5 title-sm text-llamaai-announcement-link-text ring-1 ring-llamaai-announcement-ring transition-colors hover:bg-llamaai-announcement-link-hover"
				>
					Try LlamaAI →
				</BasicLink>
			</span>
		</Announcement>
	)
}
