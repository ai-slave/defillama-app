import { useSyncExternalStore } from 'react'
import { TabLink, TabNav } from '~/ui/Tabs'

type TokenPageSectionNavItem = {
	id: string
	label: string
}

// A section is current once its heading scrolls above this line, just under the sticky nav. A pill jump lands its
// heading at scroll-mt-24 (96px), above the line.
const READING_LINE_PX = 140

// The current section follows from where the page is, so it is read from the headings on every scroll rather than
// pieced together from observer callbacks: a jump (scroll restoration, Home or End, a scrollbar drag) can carry a
// heading past any band without it ever being reported inside it.
function readScrolledSectionId(sections: Array<TokenPageSectionNavItem>) {
	let current = sections[0]!.id
	for (const section of sections) {
		const heading = document.getElementById(section.id)
		if (heading && heading.getBoundingClientRect().top <= READING_LINE_PX) current = section.id
	}
	return current
}

// A click holds the highlight on its section until that section reaches the line or the reader moves the page
// themselves. The end of the jump is not a release: a short last section never reaches the line, and the section
// above it has. Scrollbar drags arrive as pointerdown.
let clickedSectionId: string | null = null
const listeners = new Set<() => void>()
const releaseEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

function notifyListeners() {
	for (const listener of listeners) listener()
}

function handleScroll() {
	const heading = clickedSectionId ? document.getElementById(clickedSectionId) : null
	if (heading && heading.getBoundingClientRect().top <= READING_LINE_PX) clickedSectionId = null
	notifyListeners()
}

function releaseClick() {
	clickedSectionId = null
}

// Sections that load or grow move the headings without a scroll, for example after a restored scroll position lands
// before the tables fill in, so a change in the page's size is read as well.
let bodyResizeObserver: ResizeObserver | null = null

function subscribeToScroll(listener: () => void) {
	listeners.add(listener)
	if (listeners.size === 1) {
		window.addEventListener('scroll', handleScroll, { passive: true })
		for (const type of releaseEvents) window.addEventListener(type, releaseClick, { passive: true })
		bodyResizeObserver = new ResizeObserver(notifyListeners)
		bodyResizeObserver.observe(document.body)
	}
	return () => {
		listeners.delete(listener)
		if (listeners.size > 0) return
		clickedSectionId = null
		window.removeEventListener('scroll', handleScroll)
		for (const type of releaseEvents) window.removeEventListener(type, releaseClick)
		bodyResizeObserver!.disconnect()
		bodyResizeObserver = null
	}
}

// Runs when a pill becomes active, since its ref changes from undefined to this function, and when an active pill
// mounts. It only scrolls the nav when the pill is outside it, so a repeat call is harmless.
function revealInNav(link: HTMLAnchorElement | null) {
	const nav = link?.parentElement
	if (!link || !nav) return
	const navRect = nav.getBoundingClientRect()
	const linkRect = link.getBoundingClientRect()
	const linkLeft = linkRect.left - navRect.left + nav.scrollLeft
	const linkRight = linkLeft + linkRect.width
	const visibleLeft = nav.scrollLeft
	const visibleRight = visibleLeft + nav.clientWidth

	if (linkLeft < visibleLeft) {
		nav.scrollLeft = linkLeft
	} else if (linkRight > visibleRight) {
		nav.scrollLeft = linkRight - nav.clientWidth
	}
}

export function TokenPageSectionNav({ sections }: { sections: Array<TokenPageSectionNavItem> }) {
	// The server has no scroll position, so it renders the first section; hydration then reads where the page is,
	// which also covers a section hash and a restored scroll position.
	const activeSectionId = useSyncExternalStore(
		subscribeToScroll,
		() => (sections.length === 0 ? '' : (clickedSectionId ?? readScrolledSectionId(sections))),
		() => sections[0]?.id ?? ''
	)
	if (sections.length === 0) return null

	return (
		<div className="sticky top-0 z-20 bg-surface">
			<TabNav label="Token page sections">
				{sections.map((section) => {
					const isActive = activeSectionId === section.id

					return (
						<TabLink
							key={section.id}
							href={`#${section.id}`}
							ref={isActive ? revealInNav : undefined}
							aria-current={isActive ? 'location' : undefined}
							onClick={() => {
								clickedSectionId = section.id
								notifyListeners()
							}}
							data-active={isActive}
						>
							{section.label}
						</TabLink>
					)
				})}
			</TabNav>
		</div>
	)
}
