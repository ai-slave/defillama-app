import * as Ariakit from '@ariakit/react'
import { popoverHovercardSurfaceStyles } from '~/ui/Popover'

interface IHovercard {
	content: React.ReactNode
	children: React.ReactNode
	/** Anchor layout classes; the anchor renders as a span unless `render` is given. */
	className?: string
	/** Custom anchor element, e.g. render={<button onClick={...} />}. */
	render?: React.ReactElement
	placement?: 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'right'
	/** Classes for the card body; defaults to p-3. */
	contentClassName?: string
	/** Tap/click on the anchor also opens the card (the touch path). Turn off
	    ONLY when the anchor has its own click action (e.g. a real button). */
	showOnClick?: boolean
}

/**
 * Hover/focus card for structured content — unlike a text `<Tooltip>` it can
 * be hovered into, dismissed with Escape, and reached by keyboard via the
 * built-in HovercardDisclosure. The anchor also opens on tap/click unless
 * `showOnClick={false}`, so the content stays reachable on touch. Plain short
 * text belongs in `<Tooltip>`; click-interactive content belongs in a real
 * popover.
 */
export function Hovercard({
	content,
	children,
	className,
	render,
	placement = 'top-start',
	contentClassName,
	showOnClick = true
}: IHovercard) {
	const store = Ariakit.useHovercardStore({ placement, timeout: 150 })

	if (!content) return <>{children}</>

	return (
		<Ariakit.HovercardProvider store={store}>
			<Ariakit.HovercardAnchor
				store={store}
				className={`flex shrink-0 items-center ${className ?? ''}`}
				render={render ?? <span />}
				{...(showOnClick ? { onClick: () => store.show() } : {})}
			>
				{children}
			</Ariakit.HovercardAnchor>
			<Ariakit.HovercardDisclosure />
			<Ariakit.Hovercard
				className={`${popoverHovercardSurfaceStyles} ${contentClassName ?? 'p-3'}`}
				gutter={6}
				portal
				unmountOnHide
				hideOnInteractOutside
			>
				{content}
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}
