export function isDashboardWidget(item: { kind: string } | null | undefined) {
	return !!item && item.kind !== 'section'
}

export function countDashboardWidgets(items: ReadonlyArray<{ kind: string } | null | undefined>) {
	let count = 0
	for (const item of items) if (isDashboardWidget(item)) count++
	return count
}
