import { InlineStatus } from '~/ui/Status'

/** Tells the reader what an opened preset lost to today's data. Sits at the foot of the modal header. */
export function SavedPresetNotice({ notices }: { notices: Array<string> }) {
	if (notices.length === 0) return null
	return (
		<div className="border-t border-subtle px-4 py-2">
			<InlineStatus variant="warning">
				{notices.length === 1 ? (
					notices[0]
				) : (
					<ul className="list-disc pl-4">
						{notices.map((notice) => (
							<li key={notice}>{notice}</li>
						))}
					</ul>
				)}
			</InlineStatus>
		</div>
	)
}
