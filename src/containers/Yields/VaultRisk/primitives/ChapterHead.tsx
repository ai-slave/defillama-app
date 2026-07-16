// A panel's lead-in. The tab is navigation; the visible heading gives the panel its own
// hierarchy once the reader is inside it.
export function ChapterHead({
	title,
	hint,
	children
}: {
	title: string
	hint: React.ReactNode
	children?: React.ReactNode // optional extras under the hint (e.g. the pooled-market note)
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<h3 className="heading-xs text-primary">{title}</h3>
			<p className="max-w-3xl body-md text-secondary">{hint}</p>
			{children}
		</div>
	)
}
