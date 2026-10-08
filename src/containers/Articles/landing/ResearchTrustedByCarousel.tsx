import Link from 'next/link'
import React, { useEffect, useRef } from 'react'
import type { TrustedLogo } from '~/containers/Articles/types'
import { useMedia } from '~/hooks/useMedia'

interface Logo {
	id: string | number
	name: string
	logo: string
	link: string
}

const TRUSTED_BY_LOGOS: Array<Logo> = [
	{ id: 1, name: 'Arbitrum', logo: '/assets/research/partners/arbitrum.webp', link: 'https://arbitrum.io/' },
	{ id: 2, name: 'Bybit', logo: '/assets/research/partners/bybit.webp', link: 'https://www.bybit.com/' },
	{ id: 3, name: 'KPK', logo: '/assets/research/partners/kpk.webp', link: 'https://kpk.io/' },
	{ id: 4, name: 'RedStone', logo: '/assets/research/partners/redstone.webp', link: 'https://redstone.finance/' },
	{ id: 5, name: 'Katana', logo: '/assets/research/partners/katana.webp', link: 'https://katana.network/' },
	{
		id: 6,
		name: 'MarketAcross',
		logo: '/assets/research/partners/market-across.webp',
		link: 'https://marketacross.com/'
	},
	{ id: 7, name: 'Chainwire', logo: '/assets/research/partners/chainwire.webp', link: 'https://chainwire.org/' },
	{ id: 8, name: 'PR Genius', logo: '/assets/research/partners/pr-genius.webp', link: 'https://www.theprgenius.com/' },
	{ id: 9, name: 'Sentora', logo: '/assets/research/partners/sentora.webp', link: 'https://sentora.com/' },
	{ id: 10, name: 'Trezor', logo: '/assets/research/partners/trezor.webp', link: 'https://trezor.io/' },
	{ id: 11, name: '0G', logo: '/assets/research/partners/0G.webp', link: 'https://0g.ai/' },
	{ id: 12, name: '1inch', logo: '/assets/research/partners/1inch.webp', link: 'https://1inch.io/' },
	{ id: 13, name: 'Plasma', logo: '/assets/research/partners/plasma.webp', link: 'https://www.plasma.to/' },
	{ id: 14, name: 'Shaga', logo: '/assets/research/partners/shaga.webp', link: 'https://www.shaga.xyz/' }
]

const GAP_PX = 16
// Scroll speed in pixels per frame at 60fps
const SPEED_PX_PER_FRAME = 0.8
const FRAME_MS = 1000 / 60

const renderLogo = (item: Logo) => (
	<Link
		key={item.id}
		href={item.link}
		rel="nofollow noopener noreferrer"
		target="_blank"
		className="relative inline-flex h-[56px] w-[131px] shrink-0 items-center justify-center rounded-[6px] border border-brand-strong bg-equity-logo px-4.5 py-3 lg:h-[96px] lg:w-[236px] lg:px-9"
	>
		<img
			src={item.logo}
			alt={item.name}
			className="max-h-[25px] max-w-[125px] object-contain transition-opacity duration-500 hover:opacity-50 lg:max-h-[35px] lg:max-w-[195px]"
			loading="lazy"
			decoding="async"
		/>
	</Link>
)

const getMobileItems = (items: Array<React.ReactNode>): Array<React.ReactNode> => {
	const mobileItems: Array<React.ReactNode> = []
	for (let i = 0; i < items.length; i += 2) {
		const slideItems = items.slice(i, i + 2)
		mobileItems.push(
			<div key={`slide-${i}`} className="grid shrink-0 grid-cols-1 gap-4">
				{/* renderLogo supplies logo keys; unkeyed children would fall back to positional identity here. */}
				{React.Children.map(slideItems, (item) => (
					<div className="flex items-center justify-center">{item}</div>
				))}
			</div>
		)
	}
	return mobileItems
}

const toLogo = (logo: TrustedLogo): Logo => ({
	id: logo.id,
	name: logo.name,
	logo: logo.imageUrl,
	link: logo.linkUrl
})

interface LogosCarouselProps {
	items: Array<React.ReactNode>
	speed?: number
}

function LogosCarousel({ items, speed = SPEED_PX_PER_FRAME }: LogosCarouselProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const firstSetRef = useRef<HTMLDivElement>(null)
	const rafIdRef = useRef<number | null>(null)
	const lastTimeRef = useRef<number | null>(null)
	const pausedRef = useRef(false)

	useEffect(() => {
		const container = containerRef.current
		const firstSet = firstSetRef.current
		if (!container || !firstSet) return

		const prefersReducedMotion =
			typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
		if (prefersReducedMotion) return

		container.scrollLeft = 0

		const tick = (now: number) => {
			if (lastTimeRef.current == null) {
				lastTimeRef.current = now
			}
			// Cap delta so tab switches / long pauses don't cause a giant jump
			const delta = Math.min(now - lastTimeRef.current, 50)
			lastTimeRef.current = now

			if (!pausedRef.current) {
				const pixels = (speed * delta) / FRAME_MS
				container.scrollLeft += pixels

				// One full period = the width of one set + the gap that separates it from the next set
				const loopLength = firstSet.offsetWidth + GAP_PX
				if (loopLength > 0 && container.scrollLeft >= loopLength) {
					container.scrollLeft -= loopLength
				}
			}

			rafIdRef.current = requestAnimationFrame(tick)
		}

		rafIdRef.current = requestAnimationFrame(tick)

		return () => {
			if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current)
			rafIdRef.current = null
			lastTimeRef.current = null
		}
	}, [speed])

	const pause = () => {
		pausedRef.current = true
	}
	const resume = () => {
		pausedRef.current = false
	}

	return (
		<div
			ref={containerRef}
			onMouseEnter={pause}
			onMouseLeave={resume}
			onTouchStart={pause}
			onTouchEnd={resume}
			onTouchCancel={resume}
			className="flex scrollbar-none gap-4 overflow-hidden"
		>
			<div ref={firstSetRef} className="flex shrink-0 gap-4">
				{items}
			</div>
			<div className="flex shrink-0 gap-4" aria-hidden="true">
				{items}
			</div>
		</div>
	)
}

export function ResearchTrustedByCarousel({ logos }: { logos?: Array<TrustedLogo> | null }) {
	const isMobile = useMedia('(max-width: 1023px)')

	const trustedByItems = logos && logos.length > 0 ? logos.map(toLogo) : TRUSTED_BY_LOGOS
	const desktopItems = trustedByItems.map(renderLogo)
	const mobileItems = getMobileItems(desktopItems)

	const items = isMobile ? mobileItems : desktopItems

	return <LogosCarousel items={items} />
}
