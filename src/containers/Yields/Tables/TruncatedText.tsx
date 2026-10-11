import * as Ariakit from '@ariakit/react'
import { tooltipSurfaceStyles } from '~/ui/Popover'

const isClipped = (element: HTMLElement) => element.scrollWidth > element.clientWidth

/** One-line cell text that shows its full value in a tooltip only while it is clipped. It keeps its own Ariakit store
    rather than `Tooltip`, whose tap always toggles: here a tap on text that fits must show nothing. */
export function TruncatedText({
	text,
	className,
	children
}: {
	text: string
	className?: string
	children?: React.ReactNode
}) {
	const store = Ariakit.useTooltipStore({ placement: 'top-start' })
	return (
		<Ariakit.TooltipProvider store={store}>
			<Ariakit.TooltipAnchor
				store={store}
				render={<span />}
				className={`block max-w-full truncate ${className ?? ''}`}
				showOnHover={(event) => isClipped(event.currentTarget)}
				onTouchStart={(event) => {
					if (isClipped(event.currentTarget)) store.toggle()
				}}
				onMouseLeave={store.hide}
			>
				{children ?? text}
			</Ariakit.TooltipAnchor>
			<Ariakit.Tooltip
				store={store}
				className={`${tooltipSurfaceStyles} max-w-56 whitespace-pre-wrap`}
				unmountOnHide
				portal
			>
				<div className="p-2">{text}</div>
			</Ariakit.Tooltip>
		</Ariakit.TooltipProvider>
	)
}
