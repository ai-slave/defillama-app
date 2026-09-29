import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { TabLink, tabTrackStyles } from '~/ui/Tab'

type TokenPageSectionNavItem = {
	id: string
	label: string
}

export function TokenPageSectionNav({ sections }: { sections: Array<TokenPageSectionNavItem> }) {
	const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? '')
	const observerEntries = useRef(new Map<string, IntersectionObserverEntry>())
	const navRef = useRef<HTMLElement | null>(null)
	const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
	const clickLockTargetId = useRef<string | null>(null)
	const sectionIds = useMemo(() => sections.map((section) => section.id), [sections])
	const initialHashSectionId = useMemo(() => {
		if (typeof window === 'undefined') return null
		const hashSectionId = window.location.hash.slice(1)
		return sectionIds.includes(hashSectionId) ? hashSectionId : null
	}, [sectionIds])

	// An Effect Event: the observer effect below is the only caller, and it must see the latest sections.
	const syncActiveSection = useEffectEvent((nextActiveSectionId: string) => {
		setActiveSectionId((currentActiveSectionId) => {
			if (currentActiveSectionId === nextActiveSectionId) return currentActiveSectionId

			return nextActiveSectionId
		})
	})

	useEffect(() => {
		// The hash target is only known on the client, so highlighting it has to wait for the mount: reading
		// window.location.hash during render would not match the server markup.
		const nextSectionId = initialHashSectionId ?? sectionIds[0]
		// oxlint-disable-next-line react/set-state-in-effect -- see above
		if (nextSectionId) setActiveSectionId(nextSectionId)
	}, [initialHashSectionId, sectionIds])

	useEffect(() => {
		if (!activeSectionId) return

		const navElement = navRef.current
		const linkElement = linkRefs.current[activeSectionId]
		if (!navElement || !linkElement) return

		const navRect = navElement.getBoundingClientRect()
		const linkRect = linkElement.getBoundingClientRect()
		const linkLeft = linkRect.left - navRect.left + navElement.scrollLeft
		const linkRight = linkLeft + linkRect.width
		const visibleLeft = navElement.scrollLeft
		const visibleRight = visibleLeft + navElement.clientWidth

		if (linkLeft < visibleLeft) {
			navElement.scrollLeft = linkLeft
		} else if (linkRight > visibleRight) {
			navElement.scrollLeft = linkRight - navElement.clientWidth
		}
	}, [activeSectionId])

	useEffect(() => {
		if (sectionIds.length === 0 || typeof window === 'undefined') return
		const observerEntriesMap = observerEntries.current

		const maybeReleaseClickLock = () => {
			if (!clickLockTargetId.current) return false

			const targetElement = document.getElementById(clickLockTargetId.current)
			if (targetElement && targetElement.getBoundingClientRect().top <= 140) {
				clickLockTargetId.current = null
				return true
			}

			return false
		}

		const updateFromObserver = () => {
			if (clickLockTargetId.current && !maybeReleaseClickLock()) return

			const candidateEntries = sectionIds
				.map((sectionId) => observerEntriesMap.get(sectionId))
				.filter((entry): entry is IntersectionObserverEntry => Boolean(entry?.isIntersecting))

			if (candidateEntries.length === 0) return

			const entriesById = new Map(candidateEntries.map((entry) => [entry.target.id, entry]))
			const entriesAtThreshold = sectionIds.filter((sectionId) => {
				const entry = entriesById.get(sectionId)
				return entry ? entry.boundingClientRect.top <= 140 : false
			})

			let closest = candidateEntries[0]!
			for (const entry of candidateEntries) {
				if (entry.boundingClientRect.top < closest.boundingClientRect.top) closest = entry
			}
			const nextActiveSectionId = entriesAtThreshold.at(-1) ?? closest.target.id

			syncActiveSection(nextActiveSectionId)
		}

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					observerEntriesMap.set(entry.target.id, entry)
				}
				updateFromObserver()
			},
			{
				rootMargin: '-140px 0px -60% 0px',
				threshold: [0, 1]
			}
		)

		for (const sectionId of sectionIds) {
			const sectionElement = document.getElementById(sectionId)
			if (sectionElement) observer.observe(sectionElement)
		}

		const frameId = window.requestAnimationFrame(() => {
			if (!initialHashSectionId) {
				updateFromObserver()
			}
		})

		// A click holds the highlight on its section until that section reaches the top or the reader moves the page
		// themselves. The end of the jump is not a release: a short last section never reaches the top, and the section
		// above it can still fill the observer's band. Scrollbar drags arrive as pointerdown.
		const releaseClickLock = () => {
			clickLockTargetId.current = null
		}
		const releaseEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
		for (const type of releaseEvents) window.addEventListener(type, releaseClickLock, { passive: true })

		return () => {
			window.cancelAnimationFrame(frameId)
			for (const type of releaseEvents) window.removeEventListener(type, releaseClickLock)
			observer.disconnect()
			observerEntriesMap.clear()
		}
	}, [initialHashSectionId, sectionIds])

	if (sections.length === 0) return null

	return (
		<div className="sticky top-0 z-20 bg-surface">
			<nav ref={navRef} className={tabTrackStyles} aria-label="Token page sections">
				{sections.map((section) => {
					const isActive = activeSectionId === section.id

					return (
						<TabLink
							key={section.id}
							href={`#${section.id}`}
							ref={(element) => {
								if (!element) return
								linkRefs.current[section.id] = element
								return () => {
									delete linkRefs.current[section.id]
								}
							}}
							aria-current={isActive ? 'location' : undefined}
							onClick={() => {
								setActiveSectionId(section.id)
								clickLockTargetId.current = section.id
							}}
							data-active={isActive}
						>
							{section.label}
						</TabLink>
					)
				})}
			</nav>
		</div>
	)
}
