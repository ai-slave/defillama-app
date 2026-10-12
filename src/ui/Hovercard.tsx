import * as Ariakit from '@ariakit/react'
import { isValidElement, type ReactElement } from 'react'
import { Button } from './Button'
import { definitionMarkStyles } from './internal/definitionMark'
import { SURFACE_WIDTH_LADDER, surfaceMotionStyles } from './internal/Popover'

interface IHovercard {
	content: React.ReactNode
	children: React.ReactNode
	/** Anchor layout classes; the anchor renders as a span unless `render` is given.
	    The anchor is inline-flex so it sizes to its content and follows the parent's
	    text-align, like a table cell's `align`. Do not pass another display class:
	    `inline-flex` sorts after `flex`, `block` and `inline-block`, so it always wins. */
	className?: string
	/** Custom anchor element, e.g. render={<button onClick={...} />}. */
	render?: React.ReactElement
	placement?: Ariakit.HovercardProviderProps['placement']
	/** The card's preferred width (see Width below); the viewport caps it. */
	width?: keyof typeof WIDTH
	/** Layout of the card body (flex, grid, gap, a max height). The card owns its width, padding and type. */
	contentClassName?: string
	/** Tap/click on the anchor also opens the card (the touch path). Turn off
	    ONLY when the anchor has its own click action (e.g. a real button). */
	showOnClick?: boolean
	/** Called each time the card opens, whether by hover, focus or tap. */
	onOpen?: () => void
	/** The anchor is text that explains itself (a value with a breakdown): it draws Definition's dotted mark. */
	definition?: boolean
}

const WIDTH = {
	fit: 'w-max',
	md: SURFACE_WIDTH_LADDER.md,
	lg: SURFACE_WIDTH_LADDER.lg
}

const surfaceStyles = `z-50 max-h-[min(calc(100dvh-80px),var(--popover-available-height))] max-w-(--popover-available-width) overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay p-3 body-sm text-primary shadow-overlay ${surfaceMotionStyles}`

// A side card tries the other side, then below and above, before squeezing into a narrow viewport.
const SIDE_FALLBACKS: Record<string, string> = {
	right: 'left-start bottom-start top-start',
	left: 'right-start bottom-start top-start'
}

/**
 * Hover/focus card for structured or long content (lists, breakdowns, definitions, previews). Unlike a text
 * `<Tooltip>` it can be hovered into, dismissed with Escape, and reached by keyboard via the built-in
 * HovercardDisclosure. The anchor also opens on tap/click unless `showOnClick={false}`, so the content stays
 * reachable on touch.
 *
 * Which surface: plain short text is a `<Tooltip>`. When opening the surface is the primary action, or the content
 * is a form or control set, use a popover, menu or dialog. A preview here may hold a few links or actions while
 * keyboard and touch access stay intact. When the anchor has its own click action, keep it and add a separate
 * labeled info control. The "N chains" list is the shared `ProtocolChainsHovercard`.
 *
 * Anchor: inline-flex, so it sizes to its content and follows the parent's `text-align`. Put truncating text in an
 * inner `<span className="truncate">` with `max-w-full` on the anchor; a bar that fills its cell adds `w-full`; an
 * anchor with no text (a pie, a bar) adds `align-middle` so it leaves the text baseline. In a `flex-col` parent the
 * anchor stretches to the column's width, and a side card opens past the widest sibling; add `self-start`.
 * `className` places the anchor and aligns what it holds; it never styles it (policy: check-part-classes). Text that
 * explains itself passes `definition` for Definition's dotted mark, and a control is the `render` anchor.
 *
 * Placement: an anchor in a table cell opens to the side (`right-start`, or `left-start` near the table's end). A card
 * above or below covers the neighboring row, and Ariakit keeps it open while the pointer moves toward it, so it
 * swallows the click on that row. A side card that has no room falls back below.
 *
 * Width: the surface caps itself with Ariakit's `--popover-available-width` and `--popover-available-height` and
 * keeps 16px from the viewport edges. `width` picks the preferred width: `fit` (the default) sizes to the content,
 * for compact vertical lists, icon rows and tables; `md` (320px) for prose and ordinary cards; `lg` (384px) for
 * dense financial breakdowns. `md` and `lg` are the popover surfaces' ladder, so a name is one width everywhere.
 * Content never sizes the card itself (`w-80`): it passes `width`. Long content scrolls inside the available height.
 * Never reproduce anchored safety with `calc(100vw - …)`.
 *
 * The card owns its 12px padding, body-sm type and text-primary color, so every card reads the same; content that
 * needs a full-bleed header or table puts its own negative margin on that element and says why.
 *
 * Keyboard: a button anchor (`render={<button … />}`, a Button, or a part given `render={<button … />}`) opens the
 * card on Enter or Space, announces `aria-expanded`, and needs no second tab stop. Any other anchor (text, a link)
 * is a tab stop followed by the "Show details" disclosure, hidden until focus reaches the anchor. Opening by keyboard
 * moves focus to the card's first control; a definition there stays closed, since a Tooltip ignores focus that code
 * moved. Escape closes a tooltip the reader opened inside first, then the card, and returns focus to what opened it
 * (the button anchor or the disclosure). A mouse click opens it without moving focus. Whether the anchor is a button comes from `render`, never from the store's `anchorElement`, which this
 * render sets (docs/focus-and-errors.md).
 */
export function Hovercard({
	content,
	children,
	className,
	render,
	placement = 'top-start',
	width = 'fit',
	contentClassName,
	showOnClick = true,
	onOpen,
	definition = false
}: IHovercard) {
	const store = Ariakit.useHovercardStore({
		placement,
		timeout: 150,
		setOpen: (open) => {
			if (open) onOpen?.()
		}
	})

	const open = Ariakit.useStoreState(store, 'open')
	const anchorIsButton = showOnClick && rendersButton(render)

	if (!content) return <>{children}</>

	return (
		<Ariakit.HovercardProvider store={store}>
			<Ariakit.HovercardAnchor
				store={store}
				className={`inline-flex shrink-0 items-center ${definition ? definitionMarkStyles : ''} ${className ?? ''}`}
				render={render ?? <span />}
				aria-expanded={anchorIsButton ? open : undefined}
				aria-haspopup={anchorIsButton ? 'dialog' : undefined}
				{...(showOnClick
					? {
							onClick: (event: React.MouseEvent<HTMLElement>) => {
								// A key press clicks with detail 0: focus moves into the card, and back here when it closes.
								if (event.detail === 0) {
									store.setDisclosureElement(event.currentTarget)
									store.setAutoFocusOnShow(true)
								}
								store.show()
							}
						}
					: {})}
			>
				{children}
			</Ariakit.HovercardAnchor>
			{anchorIsButton ? null : <Ariakit.HovercardDisclosure aria-label="Show details" />}
			<Ariakit.Hovercard
				className={`${surfaceStyles} ${WIDTH[width]} ${contentClassName ?? ''}`}
				gutter={6}
				overflowPadding={16}
				flip={SIDE_FALLBACKS[placement.split('-')[0]] ?? true}
				portal
				unmountOnHide
				hideOnInteractOutside
			>
				{content}
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}

/** Whether the anchor renders a button: decided from the `render` element, so the server and client agree. */
function rendersButton(element: ReactElement | undefined): boolean {
	if (!isValidElement<{ render?: ReactElement }>(element)) return false
	return element.type === 'button' || element.type === Button || rendersButton(element.props.render)
}
