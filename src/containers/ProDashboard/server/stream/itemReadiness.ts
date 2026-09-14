import type { DashboardItemConfig } from '../../dashboardItemConfig'

export interface StreamItemReadiness {
	register: (itemId: string, sourceKey: string) => void
	settle: (sourceKey: string) => Array<string>
	markReady: (itemIds: ReadonlyArray<string>) => Array<string>
	unregistered: () => Array<string>
	pending: () => Array<string>
}

export function chartPlanSourceKey(itemId: string) {
	return `chart-plan:${itemId}`
}

export function createStreamItemReadiness(items: ReadonlyArray<DashboardItemConfig>): StreamItemReadiness {
	const itemIds = items.map((item) => item.id)
	const sourcesByItem = new Map<string, Set<string>>()
	const itemsBySource = new Map<string, Set<string>>()
	const ready = new Set<string>()

	const register = (itemId: string, sourceKey: string) => {
		if (ready.has(itemId)) return
		let sources = sourcesByItem.get(itemId)
		if (!sources) {
			sources = new Set()
			sourcesByItem.set(itemId, sources)
		}
		sources.add(sourceKey)
		let dependents = itemsBySource.get(sourceKey)
		if (!dependents) {
			dependents = new Set()
			itemsBySource.set(sourceKey, dependents)
		}
		dependents.add(itemId)
	}

	const markReady = (ids: ReadonlyArray<string>) => {
		const newlyReady: Array<string> = []
		for (const id of ids) {
			if (ready.has(id)) continue
			ready.add(id)
			sourcesByItem.delete(id)
			newlyReady.push(id)
		}
		return newlyReady
	}

	const settle = (sourceKey: string) => {
		const dependents = itemsBySource.get(sourceKey)
		itemsBySource.delete(sourceKey)
		if (!dependents) return []
		const newlyReady: Array<string> = []
		for (const itemId of dependents) {
			const sources = sourcesByItem.get(itemId)
			if (!sources) continue
			sources.delete(sourceKey)
			if (sources.size === 0 && !ready.has(itemId)) {
				ready.add(itemId)
				sourcesByItem.delete(itemId)
				newlyReady.push(itemId)
			}
		}
		return newlyReady
	}

	const unregistered = () => itemIds.filter((id) => !ready.has(id) && !sourcesByItem.has(id))
	const pending = () => itemIds.filter((id) => !ready.has(id))

	return { register, settle, markReady, unregistered, pending }
}

export interface StreamSourceRegistry {
	sourceKey: (kind: string, key: ReadonlyArray<unknown>) => string
	register: (itemId: string, sourceKey: string) => void
	claim: (sourceKey: string) => boolean
	schedule: (sourceKey: string, run: () => Promise<void>) => Promise<void>
}

export function streamSourceKey(kind: string, key: ReadonlyArray<unknown>) {
	return `${kind}:${JSON.stringify(key)}`
}

export function createStreamSourceRegistry(
	readiness: StreamItemReadiness,
	scheduleTask: (run: () => Promise<void>) => Promise<void>,
	onItemsReady: (itemIds: Array<string>) => Promise<void>
): StreamSourceRegistry {
	const claimed = new Set<string>()
	const settle = (sourceKey: string) => {
		const readyItemIds = readiness.settle(sourceKey)
		return readyItemIds.length > 0 ? onItemsReady(readyItemIds) : Promise.resolve()
	}
	return {
		sourceKey: streamSourceKey,
		register: readiness.register,
		claim: (sourceKey) => {
			if (claimed.has(sourceKey)) return false
			claimed.add(sourceKey)
			return true
		},
		schedule: (sourceKey, run) => scheduleTask(run).finally(() => settle(sourceKey))
	}
}
