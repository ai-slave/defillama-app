import type { ReactNode } from 'react'
import { SortableDragHandle } from '~/containers/ProtocolOverview/ProtocolPro'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { useDashboardCardContext } from './DashboardCardContext'
import { ProCardEditControls, type ProCardOverflowMenuProps, ProCardOverflowMenu } from './ProCardActions'

const DRAG_HANDLE_CLASS =
	'-ml-1 mt-0.5 flex shrink-0 cursor-grab items-center text-tertiary opacity-0 transition-opacity group-focus-within/dashboard-card:opacity-100 group-hover/dashboard-card:opacity-100 group-data-[arrived=true]/dashboard-card:opacity-100 hover:text-primary active:cursor-grabbing md:pointer-coarse:opacity-100'

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
						{title ? <Title className="truncate title-md text-primary">{title}</Title> : null}
						{badge}
					</div>
				) : null}
				{subtitle}
			</div>
			<div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
				{viewerControls}
				{/* The menu stays beside the edit controls' first row; on its own it wraps to a row of one. */}
				<div className="flex min-w-0 items-start gap-1">
					{controls || onEdit ? (
						<ProCardEditControls>
							{controls}
							{onEdit ? (
								<Tooltip
									content="Edit card"
									render={<Button size="sm" square variant="ghost" aria-label="Edit card" onClick={onEdit} />}
								>
									<Icon name="pencil" height={16} width={16} />
								</Tooltip>
							) : null}
						</ProCardEditControls>
					) : null}
					<ProCardOverflowMenu {...(menu ?? {})} />
				</div>
			</div>
		</div>
	)
}
