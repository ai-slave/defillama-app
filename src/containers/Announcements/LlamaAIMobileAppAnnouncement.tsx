import { Announcement, announcementCtaStyles, type AnnouncementTracking } from '~/components/Announcement'
import { BasicLink } from '~/components/Link'
import { Icon } from '~/ui/Icon'

/** Shared with the announcement registry; bump the version to re-show the banner to everyone. */
export const LLAMAAI_MOBILE_APP_ANNOUNCEMENT = { id: 'llamaai-mobile-app', version: '2026-09-22' } as const

/**
 * Cross-sell for readers who already use LlamaAI on the web: the same assistant in the DefiLlama app.
 * Blue, so it reads as a different message from the cream and gold LlamaAI promo and the gold Verified APY one.
 */
export function LlamaAIMobileAppAnnouncement({ track }: { track: AnnouncementTracking }) {
	return (
		<Announcement
			announcementId={LLAMAAI_MOBILE_APP_ANNOUNCEMENT.id}
			version={LLAMAAI_MOBILE_APP_ANNOUNCEMENT.version}
			dismissTracking={track.dismiss}
			className="app-announcement-scope relative overflow-hidden border border-app-announcement-border bg-(image:--app-announcement-bg) text-app-announcement-text shadow-app-announcement"
			contentClassName="text-center"
		>
			<span className="pointer-events-none absolute inset-y-0 -right-1/2 -left-1/2 animate-[shimmer_6s_ease-in-out_infinite] bg-(image:--app-announcement-shimmer)" />
			<span className="relative flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-app-announcement-badge-bg px-2.5 py-0.5 title-sm tracking-wide text-app-announcement-badge-text dark:ring-1 dark:ring-app-announcement-ring">
					<Icon name="smartphone" className="size-3" />
					NEW APP
				</span>
				<span className="font-medium">LlamaAI is now in the DefiLlama app.</span>
				<BasicLink {...track.cta} href="/app" className={announcementCtaStyles}>
					Get the app
					<Icon name="arrow-right" className="size-3" />
				</BasicLink>
			</span>
		</Announcement>
	)
}
