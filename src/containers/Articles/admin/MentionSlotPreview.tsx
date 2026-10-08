import { useLayoutEffect, useRef, useState } from 'react'
import { QuoteBlock, type MentionQuote } from '~/containers/Articles/landing/ResearchSocialMediaMentions'

const SLOT_CONFIG = [
	{ width: 252, size: 'small', variant: 'primary', label: 'small dark' },
	{ width: 477, size: 'large', variant: 'primary', label: 'large dark' },
	{ width: 477, size: 'large', variant: 'secondary', label: 'light' }
] as const

const SLOT_HEIGHT = 215

type Props = {
	quote: MentionQuote
	slotIndex: number
	scale?: number
}

export function MentionSlotPreview({ quote, slotIndex, scale = 1 }: Props) {
	const config = SLOT_CONFIG[((slotIndex % 3) + 3) % 3]
	const wrapperRef = useRef<HTMLDivElement>(null)
	const [clipped, setClipped] = useState(false)

	const hasQuoteContent = !!(quote.quote || quote.username)

	// Layout measurement: whether the rendered quote overflows its slot is only known after commit.
	useLayoutEffect(() => {
		if (!hasQuoteContent) {
			// oxlint-disable-next-line react/set-state-in-effect -- layout measurement result
			setClipped(false)
			return
		}
		const card = wrapperRef.current?.firstElementChild as HTMLElement | null
		const clampEl = wrapperRef.current?.querySelector('.line-clamp-5')
		const textClipped = !!clampEl && clampEl.scrollHeight > clampEl.clientHeight + 1
		const cardOverflowing = !!card && card.scrollHeight > card.clientHeight + 1
		// oxlint-disable-next-line react/set-state-in-effect -- layout measurement result
		setClipped(textClipped || cardOverflowing)
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- re-measure when the slot or any text QuoteBlock renders changes
	}, [quote.quote, quote.username, quote.social_media_name, slotIndex, hasQuoteContent])

	if (!hasQuoteContent) {
		return (
			<div
				style={{ width: config.width * scale, height: SLOT_HEIGHT * scale }}
				className="flex items-center justify-center rounded-[4px] border border-dashed border-medium bg-page/60"
			>
				<span className="body-sm text-tertiary">Empty quote</span>
			</div>
		)
	}

	return (
		<div className="grid gap-1">
			<div style={{ width: config.width * scale, height: SLOT_HEIGHT * scale }} className="overflow-hidden">
				<div
					ref={wrapperRef}
					style={{ width: config.width, transform: `scale(${scale})` }}
					className="pointer-events-none origin-top-left"
				>
					<QuoteBlock quote={quote} variant={config.variant} size={config.size} />
				</div>
			</div>
			{clipped ? <p className="body-sm text-error">Content overflows the {config.label} slot</p> : null}
		</div>
	)
}
