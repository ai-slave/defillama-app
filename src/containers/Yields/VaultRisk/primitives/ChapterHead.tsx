// A panel's lead-in: the tab carries the visible label, so only the hint renders; the
// heading survives as sr-only text so the document outline keeps a real <h3> per panel.
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
		<div className="min-w-0">
			<h3 className="sr-only">{title}</h3>
			<p className="max-w-2xl text-xs text-(--legacy-text-secondary)">{hint}</p>
			{children}
		</div>
	)
}
