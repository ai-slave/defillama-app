import * as Ariakit from '@ariakit/react'
import { tooltipSurfaceStyles } from '~/ui/Popover'

// Zero-delay hover tooltip used by the reference-rates tables (weight-in-USD hints).
interface Props extends Ariakit.TooltipAnchorOptions {
	content: React.ReactNode
	children: React.ReactNode
	placement?: Ariakit.TooltipStoreProps['placement']
	className?: string
	render?: Ariakit.TooltipAnchorOptions['render']
	wide?: boolean
}

export function InstantTooltip({ content, children, placement = 'top', className, wide, ...props }: Props) {
	const store = Ariakit.useTooltipStore({ placement, showTimeout: 0, hideTimeout: 0, skipTimeout: 0, timeout: 0 })

	if (!content || content === '') return <>{children}</>

	const sizeCls = wide ? 'min-w-[200px] max-w-[min(420px,calc(100vw-2rem))] p-3' : 'max-w-56 p-2 whitespace-pre-wrap'

	return (
		<Ariakit.TooltipProvider store={store}>
			<Ariakit.TooltipAnchor
				store={store}
				className={`flex shrink-0 items-center overflow-hidden text-ellipsis whitespace-nowrap ${className ?? ''}`}
				render={props.render ?? <span />}
				{...(props.render ? {} : { onTouchStart: store.toggle, onMouseLeave: store.hide })}
				{...props}
			>
				{children}
			</Ariakit.TooltipAnchor>
			<Ariakit.Tooltip store={store} className={`${tooltipSurfaceStyles} ${sizeCls}`} unmountOnHide portal>
				{content}
			</Ariakit.Tooltip>
		</Ariakit.TooltipProvider>
	)
}
