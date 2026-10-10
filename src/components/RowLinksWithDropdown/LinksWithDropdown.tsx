import { type AnchorHTMLAttributes, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import { BasicLink } from '~/components/Link'
import { useStableCallback } from '~/hooks/useStableCallback'
import { OtherLinks } from './OtherLinks'

interface ILink {
	label: string
	to: string
}

interface IRowLinksProps {
	links: Array<ILink>
	heading: string
	name?: string
	activeLink?: string
	alternativeOthersText?: string
}

const EMPTY_LINKS: Array<ILink> = []
const ROW_WRAP_TOLERANCE_PX = 1
const RESIZE_DEBOUNCE_MS = 100
// The server renders this many links, and the first measurement reads them. Only a row wide enough for all of them
// renders and measures the full list.
const FIRST_MEASURE_LINK_LIMIT = 20

interface OverflowState {
	renderMenuOnly: boolean
	firstOverflowIndex: number | null
	isMeasuring: boolean
	/** The link set whose first links all fit in one row, so measuring it renders every link. A new set starts
	    with the first links again. */
	measureAllSignature: string | null
	/** The link labels the last measurement saw; a different set needs measuring before it renders. */
	measuredSignature: string | null
}

const INITIAL_OVERFLOW_STATE: OverflowState = {
	renderMenuOnly: false,
	firstOverflowIndex: null,
	isMeasuring: true,
	measureAllSignature: null,
	measuredSignature: null
}

interface CachedLayout {
	linkWidths: Array<number>
	gap: number
	containerPadding: number
}

type OverflowResult = { renderMenuOnly: boolean; firstOverflowIndex: number | null }

type OverflowAction =
	| { type: 'REQUEST_MEASURE' }
	| { type: 'MEASURE_ALL'; signature: string }
	| { type: 'AWAIT_CONTAINER' }
	| { type: 'MEASURED'; result: OverflowResult; signature: string }
	| { type: 'RESIZED'; result: OverflowResult }

function assertUnreachable(action: never): never {
	throw new Error(`Unhandled OverflowAction: ${JSON.stringify(action)}`)
}

export function overflowReducer(state: OverflowState, action: OverflowAction): OverflowState {
	switch (action.type) {
		case 'REQUEST_MEASURE':
			return state.isMeasuring ? state : { ...state, isMeasuring: true }
		case 'MEASURE_ALL':
			return state.isMeasuring && state.measureAllSignature === action.signature
				? state
				: { ...state, isMeasuring: true, measureAllSignature: action.signature }
		case 'AWAIT_CONTAINER':
			return { ...state, renderMenuOnly: false, firstOverflowIndex: null, isMeasuring: true }
		case 'MEASURED': {
			const { result, signature } = action
			const didChange =
				state.renderMenuOnly !== result.renderMenuOnly ||
				state.firstOverflowIndex !== result.firstOverflowIndex ||
				state.isMeasuring ||
				state.measuredSignature !== signature
			return didChange ? { ...state, ...result, isMeasuring: false, measuredSignature: signature } : state
		}
		case 'RESIZED': {
			const { result } = action
			const didChange =
				state.renderMenuOnly !== result.renderMenuOnly || state.firstOverflowIndex !== result.firstOverflowIndex
			return didChange ? { ...state, ...result, isMeasuring: false } : state
		}
		default:
			return assertUnreachable(action)
	}
}

/** A link set the last measurement did not see renders every link for measuring, in the same render it arrives. */
export function needsMeasuring(state: OverflowState, linksLayoutSignature: string): boolean {
	return state.isMeasuring || state.measuredSignature !== linksLayoutSignature
}

function finiteOr(...values: Array<number>): number {
	for (const v of values) if (Number.isFinite(v)) return v
	return 0
}

// Full DOM measurement — reads the rendered link positions and caches widths for resize.
// Null: every rendered link fits in one row, but the row has more links than were rendered.
function measureOverflow(
	linkCount: number,
	priorityNav: HTMLDivElement | null,
	cache: React.MutableRefObject<CachedLayout | null>
): OverflowResult | null {
	if (typeof window === 'undefined') return { renderMenuOnly: false, firstOverflowIndex: null }

	if (linkCount > 2 && window.innerWidth <= 640) {
		return { renderMenuOnly: true, firstOverflowIndex: null }
	}

	if (!priorityNav) return { renderMenuOnly: false, firstOverflowIndex: null }

	const wrapper = priorityNav.getBoundingClientRect()
	const linkRects = Array.from(priorityNav.querySelectorAll<HTMLElement>('[data-priority-nav-item]'), (el) =>
		el.getBoundingClientRect()
	)

	const style = getComputedStyle(priorityNav)
	cache.current = {
		linkWidths: linkRects.map((r) => r.width),
		gap: finiteOr(parseFloat(style.columnGap), parseFloat(style.gap), 0),
		containerPadding: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
	}

	const firstRowTop = linkRects[0]?.top ?? wrapper.top

	for (let i = 0; i < linkRects.length; i++) {
		if (linkRects[i].top - firstRowTop > ROW_WRAP_TOLERANCE_PX) {
			return { renderMenuOnly: false, firstOverflowIndex: i }
		}
	}

	return linkRects.length < linkCount ? null : { renderMenuOnly: false, firstOverflowIndex: null }
}

// Pure math: recalculate overflow from cached link widths — no DOM mutation needed.
// Null: every cached width fits, but the row has links the cache never measured.
function recalculateFromCache(containerWidth: number, cached: CachedLayout, linkCount: number): OverflowResult | null {
	if (linkCount > 2 && window.innerWidth <= 640) {
		return { renderMenuOnly: true, firstOverflowIndex: null }
	}

	const availableWidth = containerWidth - cached.containerPadding
	let usedWidth = 0
	const count = Math.min(cached.linkWidths.length, linkCount)

	for (let i = 0; i < count; i++) {
		if (i > 0) usedWidth += cached.gap
		usedWidth += cached.linkWidths[i]
		if (usedWidth > availableWidth) {
			return { renderMenuOnly: false, firstOverflowIndex: i }
		}
	}

	return cached.linkWidths.length < linkCount ? null : { renderMenuOnly: false, firstOverflowIndex: null }
}

// Renders a row of chain pills clipped to one row; overflow links are removed from DOM and shown in the "Others"
// menu (OtherLinks).
// The first measurement reads the links the server rendered (hidden by CSS past one row), caches their widths, then
// trims. Only when all of them fit does it render and measure the full list.
// Resize uses cached widths for instant recalculation — no DOM churn.
//
// Pill: rounded-sm px-2 py-1 label-sm, resting bg-brand-tint + text-link, hover and focus bg-brand-tint-strong,
// active bg-brand + text-on-brand. When the active link sits in the overflow menu, the "Others" trigger takes the active
// fill and its chevron turns text-on-brand with the label, because the resting tertiary chevron vanishes on bg-brand.
export function LinksWithDropdown({
	links = EMPTY_LINKS,
	heading,
	name = 'row-links',
	activeLink,
	alternativeOthersText,
	...props
}: IRowLinksProps) {
	const [overflowState, dispatch] = useReducer(overflowReducer, INITIAL_OVERFLOW_STATE)
	const priorityNavRef = useRef<HTMLDivElement | null>(null)
	const linksLayoutSignature = useMemo(() => links.map((link) => link.label).join('\u0001'), [links])
	const cachedRef = useRef<CachedLayout | null>(null)
	// The resize listeners below call this after their debounce, so it reads the current link count. A stable
	// callback rather than an effect event: it escapes into a timer and a ResizeObserver.
	const recalculateAfterResize = useStableCallback(() => {
		const cached = cachedRef.current
		if (!cached) {
			dispatch({ type: 'REQUEST_MEASURE' })
			return
		}

		const nav = priorityNavRef.current
		if (!nav) {
			if (links.length > 2 && window.innerWidth <= 640) return
			dispatch({ type: 'REQUEST_MEASURE' })
			return
		}

		const containerWidth = nav.getBoundingClientRect().width
		const result = recalculateFromCache(containerWidth, cached, links.length)
		dispatch(result ? { type: 'RESIZED', result } : { type: 'MEASURE_ALL', signature: linksLayoutSignature })
	})

	// A new link set measures in the commit it arrives in, before paint. The cached widths need no reset: the
	// resize path only reads them through a mounted row, and the row's measurement rewrites them first.
	const isMeasuring = needsMeasuring(overflowState, linksLayoutSignature)
	const measureAll = overflowState.measureAllSignature === linksLayoutSignature

	// Full measurement: runs synchronously before paint when isMeasuring is true.
	useLayoutEffect(() => {
		if (!isMeasuring) return

		const priorityNav = priorityNavRef.current
		const result = measureOverflow(links.length, priorityNav, cachedRef)
		if (!result) {
			dispatch({ type: 'MEASURE_ALL', signature: linksLayoutSignature })
			return
		}

		// Container not mounted yet (transitioning out of renderMenuOnly).
		// Clear renderMenuOnly so the container renders, stay in measuring mode.
		if (!result.renderMenuOnly && !priorityNav) {
			dispatch({ type: 'AWAIT_CONTAINER' })
			return
		}

		dispatch({ type: 'MEASURED', result, signature: linksLayoutSignature })
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- the triggers: AWAIT_CONTAINER clears menu-only and MEASURE_ALL renders every link, and both must be measured.
	}, [isMeasuring, measureAll, overflowState.renderMenuOnly, links.length, linksLayoutSignature])

	// Resize listeners — fast cached recalculation, no two-phase render needed
	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout>
		let resizeObserver: ResizeObserver | null = null

		const handleResize = () => {
			clearTimeout(timeoutId)
			timeoutId = setTimeout(recalculateAfterResize, RESIZE_DEBOUNCE_MS)
		}

		window.addEventListener('resize', handleResize, { passive: true })
		if (typeof ResizeObserver !== 'undefined' && priorityNavRef.current) {
			resizeObserver = new ResizeObserver(handleResize)
			resizeObserver.observe(priorityNavRef.current)
		}

		return () => {
			clearTimeout(timeoutId)
			window.removeEventListener('resize', handleResize)
			resizeObserver?.disconnect()
		}
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- the trigger: switching to menu-only changes which element the listeners must observe.
	}, [overflowState.renderMenuOnly, recalculateAfterResize])

	const activeLinkIndex = activeLink ? links.findIndex((link) => link.label === activeLink) : -1
	const isActiveLinkInList = activeLinkIndex >= 0

	const overflowIndex = overflowState.renderMenuOnly ? null : overflowState.firstOverflowIndex
	const hasOverflow = overflowIndex !== null
	const isLinkInDropdown = overflowIndex !== null && activeLinkIndex >= overflowIndex

	// During measurement: render all links (CSS hides overflow). After: only visible links in DOM.
	const visibleLinks = isMeasuring
		? measureAll
			? links
			: links.slice(0, FIRST_MEASURE_LINK_LIMIT)
		: overflowIndex !== null
			? links.slice(0, overflowIndex)
			: links

	if (overflowState.renderMenuOnly) {
		return (
			<OtherLinks
				heading={heading}
				name={alternativeOthersText ?? 'Others'}
				keyPrefix={name}
				isActive={isActiveLinkInList}
				options={links}
				size="sm"
				className="w-full justify-between"
			/>
		)
	}

	return (
		<>
			<div className="flex max-h-8 flex-1 flex-wrap gap-2 overflow-hidden p-1" ref={priorityNavRef} {...props}>
				{visibleLinks.map((option, index) => (
					<LinkItem
						key={`${name}:${option.label}:${option.to}`}
						option={option}
						isActive={index === activeLinkIndex}
						data-priority-nav-item
					/>
				))}
			</div>

			{/* Render during measurement so the flex-1 container measures at the correct
			   narrower width (OtherLinks takes space as a flex sibling). useLayoutEffect
			   runs before paint so the user never sees the sentinel. */}
			{isMeasuring || hasOverflow ? (
				<OtherLinks
					heading={heading}
					name={
						isLinkInDropdown ? (activeLink ?? alternativeOthersText ?? 'Others') : (alternativeOthersText ?? 'Others')
					}
					isActive={isLinkInDropdown}
					options={links}
					keyPrefix={name}
					size="sm"
					className="mx-1"
				/>
			) : null}
		</>
	)
}

function LinkItem({
	option,
	isActive,
	...props
}: { option: ILink; isActive: boolean } & AnchorHTMLAttributes<HTMLAnchorElement>) {
	return (
		<BasicLink
			href={option.to}
			className="rounded-sm bg-brand-tint px-2 py-1 label-sm whitespace-nowrap text-link not-data-[active=true]:hover:bg-brand-tint-strong not-data-[active=true]:focus-visible:bg-brand-tint-strong data-[active=true]:bg-brand data-[active=true]:text-on-brand"
			data-active={isActive}
			aria-current={isActive ? 'page' : undefined}
			{...props}
		>
			{option.label}
		</BasicLink>
	)
}
