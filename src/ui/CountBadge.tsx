/** The small count in a trigger's label: how many values a picker holds or a dialog has applied. */
export function CountBadge({ count }: { count: number }) {
	return (
		<span className="flex min-w-4 items-center justify-center rounded-full border border-medium px-1 py-0.25 label-xs">
			{count}
		</span>
	)
}
