import * as Ariakit from '@ariakit/react'
import { tooltipSurfaceStyles } from '~/ui/Popover'

interface ITooltip extends Ariakit.TooltipOptions {
	content: string | null | React.ReactNode
	'data-fullwidth'?: boolean
	href?: string
	shallow?: boolean
	onClick?: (e: React.MouseEvent) => void
	children: React.ReactNode
	color?: string
	fontSize?: string
	className?: string
	tabIndex?: number
	placement?: Ariakit.TooltipProviderProps['placement']
	portal?: boolean
}

export function Tooltip({
	content,
	children,
	placement = 'top-start',
	className,

	...props
}: ITooltip) {
	const store = Ariakit.useTooltipStore({ placement })

	if (!content || content === '') return <>{children}</>

	return (
		<Ariakit.TooltipProvider store={store}>
			<Ariakit.TooltipAnchor
				store={store}
				className={`flex shrink-0 items-center truncate ${className ?? ''}`}
				render={<span />}
				{...(props.render ? {} : { onTouchStart: store.toggle, onMouseLeave: store.hide })}
				{...props}
			>
				{children}
			</Ariakit.TooltipAnchor>
			<Ariakit.Tooltip
				store={store}
				className={`${tooltipSurfaceStyles} max-w-56 whitespace-pre-wrap data-[fullwidth=true]:max-w-(--popover-available-width)`}
				unmountOnHide
				portal
				data-fullwidth={props['data-fullwidth']}
			>
				<div className="p-2">{content}</div>
			</Ariakit.Tooltip>
		</Ariakit.TooltipProvider>
	)
}
