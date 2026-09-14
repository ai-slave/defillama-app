import type { ReactNode } from 'react'
import { SortableDragHandle } from '~/containers/ProtocolOverview/ProtocolPro'
import { Icon } from '~/ui/Icon'
import { ProButton } from '../ui'
import { useDashboardCardContext } from './DashboardCardContext'
import { ProCardEditControls, type ProCardOverflowMenuProps, ProCardOverflowMenu } from './ProCardActions'

const DRAG_HANDLE_CLASS =
	'-ml-1 mt-0.5 flex shrink-0 cursor-grab items-center text-pro-text-tertiary opacity-0 transition-opacity group-focus-within/dashboard-card:opacity-100 group-hover/dashboard-card:opacity-100 group-data-[arrived=true]/dashboard-card:opacity-100 hover:text-pro-text-primary active:cursor-grabbing md:pointer-coarse:opacity-100'

export interface ProCardHeaderProps {
	title?: ReactNode
	subtitle?: ReactNode
	icon?: ReactNode
	badge?: ReactNode
	controls?: ReactNode
	viewerControls?: ReactNode
	menu?: ProCardOverflowMenuProps
	titleAs?: 'h2' | 'h3'
}

export function ProCardHeader({
	title,
	subtitle,
	icon,
	badge,
	controls,
	viewerControls,
	menu,
	titleAs = 'h2'
}: ProCardHeaderProps) {
	const onEdit = useDashboardCardContext()?.onEdit
	const Title = titleAs
	return (
		<div className="flex flex-wrap items-start gap-2 px-3 pt-3 pb-1">
			<SortableDragHandle label="Drag to reorder this card" className={DRAG_HANDLE_CLASS} />
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				{title || icon || badge ? (
					<div className="flex min-w-0 items-center gap-1.5">
						{icon}
						{title ? <Title className="truncate text-sm font-semibold text-pro-text-primary">{title}</Title> : null}
						{badge}
					</div>
				) : null}
				{subtitle}
			</div>
			<div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
				{viewerControls}
				{controls || onEdit ? (
					<ProCardEditControls>
						{controls}
						{onEdit ? (
							<ProButton size="sm" square variant="ghost" onClick={onEdit} title="Edit card">
								<Icon name="pencil" height={14} width={14} />
								<span className="sr-only">Edit card</span>
							</ProButton>
						) : null}
					</ProCardEditControls>
				) : null}
				<ProCardOverflowMenu {...(menu ?? {})} />
			</div>
		</div>
	)
}
