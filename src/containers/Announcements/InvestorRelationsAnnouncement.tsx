import { useAuthContext } from '~/auth'
import { Announcement, type AnnouncementTracking } from '~/components/Announcement'
import { Icon } from '~/ui/Icon'

/** Shared with the announcement registry; bump the version to re-show the banner to everyone. */
export const INVESTOR_RELATIONS_ANNOUNCEMENT = { id: 'investor-relations', version: '2026-09-22' } as const

/**
 * Shown to readers whose email domain belongs to a crypto project: most of them read protocol pages,
 * likely their own. The link carries the reader's id as `referrer`, like the chain IR banners, so the
 * investors site can attribute the visit. Indigo, so it reads as a different message from the other
 * home-slot banners.
 */
export function InvestorRelationsAnnouncement({ track }: { track: AnnouncementTracking }) {
	const { user } = useAuthContext()
	return (
		<Announcement
			announcementId={INVESTOR_RELATIONS_ANNOUNCEMENT.id}
			version={INVESTOR_RELATIONS_ANNOUNCEMENT.version}
			dismissTracking={track.dismiss}
			className="border border-ir-announcement-border bg-(image:--ir-announcement-bg) text-ir-announcement-text shadow-ir-announcement"
			contentClassName="text-center"
		>
			<span className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-ir-announcement-badge-bg px-2.5 py-0.5 title-sm tracking-wide text-ir-announcement-badge-text shadow-sm dark:ring-1 dark:ring-ir-announcement-ring">
					<Icon name="bar-chart-2" height={12} width={12} />
					IR
				</span>
				<span className="font-medium">
					Want an investor relations dashboard for your protocol?
					<span className="hidden lg:inline"> Verified metrics, reports, and investor calls in one place.</span>
				</span>
				<a
					{...track.cta}
					href={`https://investors.defillama.com${user?.id ? `?referrer=${user.id}` : ''}`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 rounded-full bg-ir-announcement-link px-2.5 py-0.5 title-sm text-ir-announcement-text ring-1 ring-ir-announcement-ring transition-colors hover:bg-ir-announcement-link-hover"
				>
					See how it works
					<Icon name="arrow-right" height={12} width={12} />
				</a>
			</span>
		</Announcement>
	)
}
