import * as Ariakit from '@ariakit/react'
import { tooltipSurfaceStyles } from '~/ui/Popover'

interface ITooltip extends Ariakit.TooltipOptions {
	content: string | null | React.ReactNode
	'data-fullwidth'?: boolean
	onClick?: (e: React.MouseEvent) => void
	children: React.ReactNode
	className?: string
	tabIndex?: number
	placement?: Ariakit.TooltipProviderProps['placement']
}

/** Elements whose tap already does something, such as a link or button: a tap there keeps that action instead of opening the tooltip. */
const TAP_ACTION_SELECTOR =
	'a[href], button, summary, input, select, textarea, label, [contenteditable="true"], [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="option"]'

export function Tooltip({ content, children, placement = 'top-start', className, ...props }: ITooltip) {
	const store = Ariakit.useTooltipStore({ placement })

	if (!content || content === '') return <>{children}</>

	return (
		<Ariakit.TooltipProvider store={store}>
			<Ariakit.TooltipAnchor
				store={store}
				className={`flex shrink-0 items-center truncate ${className ?? ''}`}
				render={<span />}
				// Touch has no hover, so a tap opens the tooltip. A `render` anchor that is, or sits in, a
				// control leaves the tap to that control; plain anchors keep toggling as they always have.
				onTouchStart={(event) => {
					if (props.render && event.currentTarget.closest(TAP_ACTION_SELECTOR)) return
					store.toggle()
				}}
				onMouseLeave={store.hide}
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
