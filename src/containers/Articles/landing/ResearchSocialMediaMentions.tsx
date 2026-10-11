import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'
import { TweetEmbed } from '~/containers/Articles/renderer/ArticleEmbedBlock'
import type { ArticleEmbedConfig, SocialMention } from '~/containers/Articles/types'
import { useMedia } from '~/hooks/useMedia'
import { Icon } from '~/ui/Icon'
import { chunkMentions } from './utils'

export interface MentionQuote {
	quote: string
	username: string
	social_media_name: string
	social_media_link: string
	x_post_id: string
}

type MentionBlock = Array<MentionQuote>

const BLOCKS: Array<MentionBlock> = [
	[
		{
			quote: 'our media partner published an in-depth look',
			username: 'mpostio',
			social_media_name: 'X',
			social_media_link: 'https://x.com/mpost_io/status/2018686524913590684',
			x_post_id: '2021009011378880997'
		},
		{
			quote: 'DeFi will win, and oracles will contribute to its success. Have a look below at why',
			username: 'RedStone',
			social_media_name: 'X',
			social_media_link: 'https://x.com/PacificMeta_ja/status/2008293046429818924',
			x_post_id: '2018686524913590684'
		},
		{
			quote:
				'these samurai warrior chads over at @dl_research are at it again. this is an incredibly well done report and katana is happy to be listed as a sponsor',
			username: 'Katana',
			social_media_name: 'X',
			social_media_link: 'https://x.com/MarcinRedStone/status/2003518298248609865',
			x_post_id: '2018285464944324652'
		}
	],
	[
		{
			quote: 'drive the DeFi industry forward Llamas',
			username: 'Katana',
			social_media_name: 'X',
			social_media_link: 'https://x.com/MarcinRedStone/status/2003518298248609865',
			x_post_id: '2003518298248609865'
		},
		{
			quote: "Here's a good starting point from @dl_research",
			username: 'Katana',
			social_media_name: 'X',
			social_media_link: 'https://x.com/Crypto_Texan/status/2021009011378880997',
			x_post_id: '2021009011378880997'
		},
		{
			quote:
				'Join us tomorrow at 11am EST for a discussion about RWAs and tokenization. Hosted by @patfscott and @themetaisok',
			username: 'DeFiLlama',
			social_media_name: 'X',
			social_media_link: 'https://x.com/DefiLlama/status/2020885843125178639',
			x_post_id: '2020885843125178639'
		}
	]
]

const AUTOPLAY_MS = 5000
const DESKTOP_TWEET_TILE_SIZE = 215
const DESKTOP_TWEET_RENDER_WIDTH = 320
const DESKTOP_TWEET_SCALE = DESKTOP_TWEET_TILE_SIZE / DESKTOP_TWEET_RENDER_WIDTH

interface QuoteBlockProps {
	quote: MentionQuote
	variant?: 'primary' | 'secondary'
	size?: 'small' | 'large'
	mobile?: boolean
}

export function QuoteBlock({ quote, variant = 'primary', size = 'large', mobile }: QuoteBlockProps) {
	if (!quote.quote && !quote.username) return null

	const bgColor = variant === 'secondary' ? 'bg-brand-tint' : 'bg-brand'
	const textColor = variant === 'secondary' ? 'text-link' : 'text-on-brand'

	const textStyles = mobile
		? 'body-lg text-center px-6.5 py-3'
		: size === 'small'
			? 'text-xl leading-[28px] text-center px-11.25 py-2.5'
			: 'text-xl leading-[24px] px-7.5 py-5'

	const containerHeight = mobile ? 'h-[160px] min-h-[160px]' : 'h-[215px]'
	const cardGap = !mobile && size === 'small' ? 'gap-2' : 'gap-4'

	return (
		<Link
			href={quote.social_media_link || '#'}
			target="_blank"
			rel="noopener noreferrer"
			className={`flex grow flex-col ${cardGap} rounded-[4px] p-3.25 ${bgColor} ${containerHeight}`}
		>
			{quote.quote && (
				<blockquote className={`relative font-semibold ${textStyles} ${textColor}`}>
					<div className={`absolute top-0 left-0 ${textColor}`}>
						{/* The sprite quote is a closing mark; turned, it opens the quote. */}
						<Icon name="quote" className="size-6 rotate-180" aria-hidden />
					</div>
					<div className="line-clamp-5">{quote.quote}</div>
					<div className={`absolute right-0 bottom-0 ${textColor}`}>
						<Icon name="quote" className="size-6" aria-hidden />
					</div>
				</blockquote>
			)}
			{quote.username && quote.social_media_name && (
				<div className={`mt-auto pl-7.5 title-md uppercase ${textColor}`}>
					@{quote.username} via {quote.social_media_name}
				</div>
			)}
		</Link>
	)
}

function TweetWidget({ tweetId, mobile }: { tweetId: string; mobile?: boolean }) {
	if (!tweetId) return null

	const sourceUrl = `https://x.com/i/status/${tweetId}`
	const config: ArticleEmbedConfig = {
		provider: 'twitter',
		url: sourceUrl,
		sourceUrl
	}

	const wrapperClass = mobile
		? 'h-[356px] w-full min-w-0 overflow-hidden rounded-[4px] bg-research-white'
		: 'h-[215px] w-[215px] min-w-[215px] overflow-hidden rounded-[4px] bg-research-white'
	const innerClass = mobile
		? 'h-full w-full overflow-hidden [&_.twitter-tweet]:m-0! [&_iframe]:m-0!'
		: 'h-[320px] w-[320px] origin-top-left overflow-hidden [&_.twitter-tweet]:m-0! [&_.twitter-tweet-rendered]:m-0! [&_iframe]:m-0!'

	return (
		<div className={wrapperClass}>
			<div className={innerClass} style={mobile ? undefined : { transform: `scale(${DESKTOP_TWEET_SCALE})` }}>
				<TweetEmbed
					config={config}
					action="Open"
					options={mobile ? undefined : { width: DESKTOP_TWEET_RENDER_WIDTH, cards: 'hidden', conversation: 'none' }}
				/>
			</div>
		</div>
	)
}

function MobileSlide({
	quote,
	tweetId,
	variant = 'primary'
}: {
	quote: MentionQuote
	tweetId: string
	variant?: 'primary' | 'secondary'
}) {
	return (
		<div className="flex w-full min-w-0 shrink-0 flex-col gap-2.5">
			<div className="h-[160px] w-full shrink-0">
				<QuoteBlock quote={quote} variant={variant} mobile />
			</div>
			<div className="h-[356px] w-full shrink-0">
				<TweetWidget tweetId={tweetId} mobile />
			</div>
		</div>
	)
}

export function BlockContent({ block, isEven }: { block: MentionBlock; isEven: boolean }) {
	const empty: MentionQuote = { quote: '', username: '', social_media_name: '', social_media_link: '', x_post_id: '' }
	const quote1 = block[0] ?? empty
	const quote2 = block[1] ?? empty
	const quote3 = block[2] ?? empty

	const hasContent = block.some((q) => q.quote || q.username || q.x_post_id)
	if (!hasContent) return null

	return (
		<div className="grid w-[992px] gap-6" style={{ gridTemplateColumns: '252px 716px' }}>
			<div className={`flex gap-6 ${isEven ? 'flex-col-reverse' : 'flex-col'}`}>
				<QuoteBlock quote={quote1} size="small" />
				<TweetWidget key={quote1.x_post_id} tweetId={quote1.x_post_id} />
			</div>
			<div className="flex flex-col gap-6">
				<div className={`flex gap-6 ${isEven ? 'flex-row-reverse' : 'flex-row'}`}>
					<TweetWidget key={quote2.x_post_id} tweetId={quote2.x_post_id} />
					<QuoteBlock quote={quote2} />
				</div>
				<div className={`flex gap-6 ${isEven ? 'flex-row-reverse' : 'flex-row'}`}>
					<QuoteBlock quote={quote3} variant="secondary" />
					<TweetWidget key={quote3.x_post_id} tweetId={quote3.x_post_id} />
				</div>
			</div>
		</div>
	)
}

interface AutoplayCarouselProps {
	slides: Array<React.ReactNode>
	containerClassName?: string
	intervalMs?: number
	showDots?: boolean
}

function AutoplayCarousel({
	slides,
	containerClassName = '',
	intervalMs = AUTOPLAY_MS,
	showDots = false
}: AutoplayCarouselProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [selectedIndex, setSelectedIndex] = useState(0)
	// A shorter slide list wraps the selection back to the first slide.
	const activeIndex = selectedIndex > slides.length - 1 ? 0 : selectedIndex

	// Smoothly scroll to the active slide whenever it changes
	useEffect(() => {
		const container = containerRef.current
		if (!container) return
		const target = container.children[activeIndex] as HTMLElement | undefined
		if (!target) return
		container.scrollTo({ left: target.offsetLeft, behavior: 'smooth' })
	}, [activeIndex])

	// Autoplay: advance one slide every intervalMs from the active slide, so manual interaction
	// (dot click / swipe) restarts the timer.
	useEffect(() => {
		if (slides.length <= 1) return

		const prefersReducedMotion =
			typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
		if (prefersReducedMotion) return

		const timer = window.setTimeout(() => {
			setSelectedIndex((activeIndex + 1) % slides.length)
		}, intervalMs)
		return () => clearTimeout(timer)
	}, [activeIndex, slides.length, intervalMs])

	// Sync selectedIndex with the slide nearest to the user's scroll position
	useEffect(() => {
		const container = containerRef.current
		if (!container || slides.length <= 1) return

		let timer: number | null = null
		const handleScroll = () => {
			if (timer != null) clearTimeout(timer)
			timer = window.setTimeout(() => {
				const scrollLeft = container.scrollLeft
				let bestIdx = 0
				let bestDiff = Infinity
				for (let i = 0; i < container.children.length; i++) {
					const child = container.children[i] as HTMLElement
					const diff = Math.abs(child.offsetLeft - scrollLeft)
					if (diff < bestDiff) {
						bestDiff = diff
						bestIdx = i
					}
				}
				setSelectedIndex((prev) => (prev !== bestIdx ? bestIdx : prev))
			}, 150)
		}

		container.addEventListener('scroll', handleScroll, { passive: true })
		return () => {
			container.removeEventListener('scroll', handleScroll)
			if (timer != null) clearTimeout(timer)
		}
	}, [slides.length])

	return (
		<div className="flex flex-col">
			<div ref={containerRef} className={`flex scrollbar-none overflow-x-auto ${containerClassName}`}>
				{slides}
			</div>
			{showDots && slides.length > 1 && (
				<div className="mt-4 flex justify-center gap-2">
					{slides.map((_, idx) => (
						<button
							// oxlint-disable-next-line react/no-array-index-key -- Dots identify slide positions, not the content occupying each slide.
							key={idx}
							type="button"
							aria-label={`Go to slide ${idx + 1}`}
							aria-current={idx === activeIndex || undefined}
							onClick={() => setSelectedIndex(idx)}
							className={`h-[8px] w-[8px] rounded-full transition-colors ${
								idx === activeIndex ? 'bg-research-accent-strong' : 'bg-border-strong'
							}`}
						/>
					))}
				</div>
			)}
		</div>
	)
}

export const toMentionQuote = (mention: SocialMention): MentionQuote => ({
	quote: mention.quote ?? '',
	username: mention.username ?? '',
	social_media_name: mention.socialMediaName,
	social_media_link: mention.socialMediaLink ?? '',
	x_post_id: mention.xPostId ?? ''
})

export function ResearchSocialMediaMentions({ mentions }: { mentions?: Array<SocialMention> | null }) {
	const isMobile = useMedia('(max-width: 767px)')

	const blocks: Array<MentionBlock> =
		mentions && mentions.length > 0 ? chunkMentions(mentions.map(toMentionQuote)) : BLOCKS

	const activeBlocks = blocks.filter((block) => block.some((q) => q.quote || q.username || q.x_post_id))

	if (activeBlocks.length === 0) return null

	const desktopSlides = activeBlocks.map((block, blockIndex) => (
		// oxlint-disable-next-line react/no-array-index-key -- Slides are layout slots; each embedded post keeps its own post identity.
		<div key={`desktop-${blockIndex}`} className="shrink-0 snap-start">
			<BlockContent block={block} isEven={blockIndex % 2 === 1} />
		</div>
	))

	const mobileSlides: Array<React.ReactNode> = []
	for (const [blockIndex, block] of activeBlocks.entries()) {
		for (const [qIndex, q] of block.entries()) {
			if (!q.quote && !q.username && !q.x_post_id) continue
			const variant: 'primary' | 'secondary' = qIndex === 2 ? 'secondary' : 'primary'
			mobileSlides.push(
				<div key={`mobile-${blockIndex}-${qIndex}`} className="w-full min-w-0 shrink-0 snap-start px-0">
					<MobileSlide quote={q} tweetId={q.x_post_id} variant={variant} />
				</div>
			)
		}
	}

	if (isMobile) {
		return <AutoplayCarousel slides={mobileSlides} containerClassName="snap-x snap-mandatory" showDots />
	}

	return <AutoplayCarousel slides={desktopSlides} containerClassName="snap-x snap-mandatory gap-6" />
}
