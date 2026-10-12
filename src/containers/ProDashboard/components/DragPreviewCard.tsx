import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { MetaLine } from '~/ui/MetaLine'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { dashboardItemKindLabel, dashboardItemLabel } from './dashboardItemLabel'
import { ProCardSkeleton, skeletonVariantForItemKind } from './ProCardSkeleton'

export function DragPreviewCard({ item }: { item: DashboardItemConfig }) {
	const label = dashboardItemLabel(item)
	const kindLabel = dashboardItemKindLabel(item.kind)
	return (
		// The ghost floats over the grid, so it takes a shadow no page card has, and keeps the card header's p-3 inset
		// so its title sits where the card's did.
		<Card padding="base" aria-hidden className="flex h-full w-full flex-col gap-2 overflow-hidden shadow-dialog">
			<div className="flex min-w-0 items-center gap-2">
				<Icon name="grip-vertical" className="size-3.5 shrink-0 text-tertiary" />
				<span className="truncate label-md text-primary">{label}</span>
				<MetaLine className="shrink-0">{label === kindLabel ? null : kindLabel}</MetaLine>
			</div>
			<ProCardSkeleton kind={skeletonVariantForItemKind(item.kind)} />
		</Card>
	)
}
