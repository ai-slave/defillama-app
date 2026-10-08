import { Icon } from '~/ui/Icon'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { ProMeta } from '../ui'
import { proCardShellStyles } from '../ui/styles'
import { dashboardItemKindLabel, dashboardItemLabel } from './dashboardItemLabel'
import { ProCardSkeleton, skeletonVariantForItemKind } from './ProCardSkeleton'

export function DragPreviewCard({ item }: { item: DashboardItemConfig }) {
	const label = dashboardItemLabel(item)
	const kindLabel = dashboardItemKindLabel(item.kind)
	return (
		<div
			aria-hidden
			className={`${proCardShellStyles} flex h-full w-full flex-col gap-2 overflow-hidden p-3 shadow-dialog`}
		>
			<div className="flex min-w-0 items-center gap-2">
				<Icon name="grip-vertical" height={14} width={14} className="shrink-0 text-tertiary" />
				<span className="truncate label-md text-primary">{label}</span>
				<ProMeta className="shrink-0" items={[label === kindLabel ? null : kindLabel]} />
			</div>
			<ProCardSkeleton kind={skeletonVariantForItemKind(item.kind)} />
		</div>
	)
}
