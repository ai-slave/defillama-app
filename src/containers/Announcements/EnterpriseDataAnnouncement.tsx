import { Announcement, type AnnouncementTracking } from '~/components/Announcement'
import { BasicLink } from '~/components/Link'
import { Icon } from '~/ui/Icon'

/** Shared with the announcement registry; bump the version to re-show the banner to everyone. */
export const ENTERPRISE_DATA_ANNOUNCEMENT = { id: 'enterprise-data', version: '2026-09-22' } as const

/**
 * Shown to readers whose email domain belongs to a fund or institution. Subscribers see it too: most
 * funds already pay for Pro, and API and enterprise plans are the step beyond it. Teal, so it reads as
 * a different message from the other home-slot banners.
 */
export function EnterpriseDataAnnouncement({ track }: { track: AnnouncementTracking }) {
	return (
		<Announcement
			announcementId={ENTERPRISE_DATA_ANNOUNCEMENT.id}
			version={ENTERPRISE_DATA_ANNOUNCEMENT.version}
			dismissTracking={track.dismiss}
			className="border border-data-announcement-border bg-(image:--data-announcement-bg) text-data-announcement-text shadow-data-announcement"
			contentClassName="text-center"
		>
			<span className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-data-announcement-badge-bg px-2.5 py-0.5 title-sm tracking-wide text-data-announcement-badge-text shadow-raised">
					<Icon name="code" height={12} width={12} />
					API
				</span>
				<span className="font-medium">
					Bring DefiLlama data into your models
					<span className="hidden lg:inline">: API access, bulk downloads, and enterprise plans</span>.
				</span>
				<BasicLink
					{...track.cta}
					href="/subscription"
					className="inline-flex items-center gap-1 rounded-full bg-data-announcement-link px-2.5 py-0.5 title-sm text-data-announcement-text ring-1 ring-data-announcement-ring transition-colors hover:bg-data-announcement-link-hover"
				>
					See plans
					<Icon name="arrow-right" height={12} width={12} />
				</BasicLink>
			</span>
		</Announcement>
	)
}
