import type { ECharts } from 'echarts/core'

interface HoverSyncMember {
	instance: ECharts
	visible: boolean
}

type HoverSyncAction = Record<string, unknown> & { type: string }

const groups = new Map<string, Set<HoverSyncMember>>()
let broadcasting = false

function broadcast(members: Set<HoverSyncMember>, source: HoverSyncMember, action: HoverSyncAction) {
	broadcasting = true
	try {
		for (const member of members) {
			if (member === source || !member.visible || member.instance.isDisposed()) continue
			member.instance.dispatchAction(action)
		}
	} finally {
		broadcasting = false
	}
}

export function joinChartHoverSync(group: string, instance: ECharts, element: Element): () => void {
	const members = groups.get(group) ?? new Set<HoverSyncMember>()
	groups.set(group, members)
	const member: HoverSyncMember = { instance, visible: true }
	members.add(member)

	const observer =
		typeof IntersectionObserver === 'undefined'
			? null
			: new IntersectionObserver((entries) => {
					member.visible = entries.some((entry) => entry.isIntersecting)
				})
	observer?.observe(element)

	const forwardAxisPointer = (event: unknown) => {
		if (broadcasting || typeof event !== 'object' || event === null) return
		broadcast(members, member, { ...(event as Record<string, unknown>), type: 'updateAxisPointer' })
	}
	const forwardLeave = () => {
		if (broadcasting) return
		broadcast(members, member, { type: 'hideTip' })
	}
	instance.on('updateAxisPointer', forwardAxisPointer)
	instance.on('globalout', forwardLeave)

	return () => {
		instance.off('updateAxisPointer', forwardAxisPointer)
		instance.off('globalout', forwardLeave)
		observer?.disconnect()
		members.delete(member)
		if (members.size === 0) groups.delete(group)
	}
}

export function chartHoverSyncGroupSize(group: string): number {
	return groups.get(group)?.size ?? 0
}
