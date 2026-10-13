import { Announcement, announcementCtaStyles } from '~/components/Announcement'
import { Icon } from '~/ui/Icon'

export function YieldsV2ApiAnnouncement() {
	return (
		<Announcement announcementId="yields-v2-api-migration" version="2026-10-13" scope="data">
			<span className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-data-announcement-badge-bg px-2.5 py-0.5 title-sm tracking-wide text-data-announcement-badge-text">
					<Icon name="code" className="size-3" />
					API
				</span>
				<span className="font-medium">
					The yields API moves to new endpoints on Nov 13, 2026
					<span className="hidden lg:inline">. Update your integration before then</span>.
				</span>
				<a
					href="https://api-docs.defillama.com/#tag/yields"
					target="_blank"
					rel="noopener noreferrer"
					className={announcementCtaStyles}
				>
					View v2 docs
					<Icon name="arrow-right" className="size-3" />
				</a>
			</span>
		</Announcement>
	)
}
