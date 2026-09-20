import { Announcement } from '~/components/Announcement'
import { BasicLink } from '~/components/Link'
import { Icon } from '~/ui/Icon'

export function UniversalTokenRatingAnnouncement() {
	return (
		<Announcement
			announcementId="universal-token-rating"
			version="2026-09-18"
			className="relative overflow-hidden border border-utr-announcement-border bg-(image:--utr-announcement-bg) text-utr-announcement-text shadow-utr-announcement"
			contentClassName="text-center"
			dismissButtonClassName="hover:bg-utr-announcement-dismiss"
		>
			<span className="pointer-events-none absolute inset-y-0 -right-1/2 -left-1/2 animate-[shimmer_6s_ease-in-out_infinite] bg-(image:--utr-announcement-shimmer)" />
			<span className="relative flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-utr-announcement-badge-bg px-2.5 py-0.5 text-xs font-bold tracking-wide text-utr-announcement-badge-text shadow-sm dark:ring-1 dark:ring-utr-announcement-ring">
					<Icon name="sparkles" height={12} width={12} />
					NEW
				</span>
				<span className="font-medium">Universal Token Rating is live: data-driven scores for every token.</span>
				<BasicLink
					href="/universal-token-rating"
					data-umami-event="utr-announcement-click"
					className="inline-flex items-center gap-1 rounded-full bg-utr-announcement-link px-2.5 py-0.5 text-xs font-semibold text-utr-announcement-text ring-1 ring-utr-announcement-ring transition-colors hover:bg-utr-announcement-link-hover"
				>
					See the ratings
					<Icon name="arrow-right" height={12} width={12} />
				</BasicLink>
			</span>
		</Announcement>
	)
}
