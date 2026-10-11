import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { ProMeta } from '../ui'
import { dashboardItemKindLabel, dashboardItemLabel } from './dashboardItemLabel'
import { ProCardSkeleton, skeletonVariantForItemKind } from './ProCardSkeleton'

export function DragPreviewCard({ item }: { item: DashboardItemConfig }) {
	const label = dashboardItemLabel(item)
	const kindLabel = dashboardItemKindLabel(item.kind)
	return (
		// The ghost floats over the grid, so it takes a shadow no page card has, and keeps the card header's p-3 inset
		// (a Card padding step it lacks) so its title sits where the card's did.
		<Card padding="none" aria-hidden className="flex h-full w-full flex-col gap-2 overflow-hidden p-3 shadow-dialog">
			<div className="flex min-w-0 items-center gap-2">
				<Icon name="grip-vertical" className="size-3.5 shrink-0 text-tertiary" />
				<span className="truncate label-md text-primary">{label}</span>
				<ProMeta className="shrink-0" items={[label === kindLabel ? null : kindLabel]} />
			</div>
			<ProCardSkeleton kind={skeletonVariantForItemKind(item.kind)} />
		</Card>
	)
}
