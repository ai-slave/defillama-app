/**
 * Preserve repeated occurrences without tying distinct identities to their display order.
 * Use only when repeated identities are interchangeable; editable records need persistent IDs.
 */
export function keyedOccurrences<T>(
	items: ReadonlyArray<T>,
	identity: (item: T) => string
): Array<{ key: string; item: T }> {
	const counts = new Map<string, number>()
	const keyed: Array<{ key: string; item: T }> = []
	for (const item of items) {
		const id = identity(item)
		const occurrence = counts.get(id) ?? 0
		counts.set(id, occurrence + 1)
		keyed.push({ key: JSON.stringify([id, occurrence]), item })
	}
	return keyed
}

/**
 * getRowKey must return a stable, sibling-unique source identity.
 * getOccurrenceKey explicitly retains occurrence order when source identity is unavailable;
 * it cannot track distinct duplicates swapping and is not a substitute for a record ID.
 */
export type RowIdentity<Row> =
	| { getRowKey: (row: Row) => string; getOccurrenceKey?: never }
	| { getRowKey?: never; getOccurrenceKey: (row: Row) => string }
