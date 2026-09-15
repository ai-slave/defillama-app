export const DISCOVERY_RAIL_SIZE = 8

export interface DiscoveryShelf<T extends { id: string }> {
	key: string
	dashboards: ReadonlyArray<T>
	keepDuplicates?: boolean
}

export function dedupeShelves<T extends { id: string }>(
	shelves: ReadonlyArray<DiscoveryShelf<T>>,
	railSize = DISCOVERY_RAIL_SIZE
): Array<{ key: string; dashboards: Array<T> }> {
	const taken = new Set<string>()
	return shelves.map((shelf) => {
		const dashboards: Array<T> = []
		for (const dashboard of shelf.dashboards) {
			if (dashboards.length >= railSize) break
			if (!shelf.keepDuplicates && taken.has(dashboard.id)) continue
			taken.add(dashboard.id)
			dashboards.push(dashboard)
		}
		return { key: shelf.key, dashboards }
	})
}
