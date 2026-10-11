import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithRef, ElementType } from 'react'
import { ReservedLabel } from '~/ui/Button'
import { BusyGlyph } from '~/ui/Status'

/* ----------------------------------------------------------------------------
   ResearchPill — the round CTA pill of the public research pages, the one
   place their editorial pills are drawn (design.md, "Product surfaces"):
   the landing hero, the footer's media-kit submit, the DefiLlama Research
   author page's Contact us and Book a call, the reports carousel's Read more
   and Download PDF, and the desktop search trigger on the banner.

   Tones:
   - white:        white fill, accent-ink text, on the navy research banner
   - whiteOutline: white line, white text, on the navy research banner
   - brand:        bg-brand fill, on-brand text, on the page (footer submit)
   Sizes are the control scale heights only: lg (44px) on the banner, md
   (32px) beside a field or inside a carousel card. Never pin a height, and
   never put an icon taller than the label line (20px) inside: heights are
   padding-driven, as in Button.

   Hover and press step the fill like Button (a brightness step on filled
   tones, the white wash on the outline); no lift, scale or glow. On the navy
   banner the focus ring is white, since a brand ring is invisible there.

   A submit passes `pendingLabel` always and sets `pending` while its request
   runs: Button's pending model (aria-busy, a spinner with the label, focus
   kept with accessibleWhenDisabled, the wider of the idle and busy widths,
   at rest too). The button
   form always keeps focus when disabled, because the only one disables itself
   once its request succeeds. Links (`as`) have nothing to wait on.

   Product pages outside research use `Button`; this pill never leaves the
   public research pages. `className` is for layout placement only.
---------------------------------------------------------------------------- */

const TONE = {
	white:
		'border-transparent bg-research-white text-research-accent-ink not-aria-disabled:hover:brightness-95 focus-visible:brightness-95 not-aria-disabled:active:brightness-90 focus-visible:outline-research-white focus-visible:outline-offset-2',
	whiteOutline:
		'border-research-white text-on-brand not-aria-disabled:hover:bg-research-white-wash focus-visible:bg-research-white-wash not-aria-disabled:active:bg-research-white-line focus-visible:outline-research-white focus-visible:outline-offset-2',
	brand:
		'border-transparent bg-brand text-on-brand not-aria-disabled:hover:brightness-110 focus-visible:brightness-110 not-aria-disabled:active:brightness-90 focus-visible:focus-ring-on-brand aria-disabled:not-aria-busy:bg-disabled aria-disabled:not-aria-busy:text-disabled'
} as const

const SIZE = {
	md: 'min-h-8 px-4 py-1.5 label-sm',
	lg: 'min-h-11 px-6 py-2.5 label-lg'
} as const

const GAP = { md: 'gap-1.5', lg: 'gap-2' } as const

type ResearchPillProps<T extends ElementType> = {
	tone: keyof typeof TONE
	size: keyof typeof SIZE
	as?: T
	/** Buttons only: the label shown while `pending`. */
	pendingLabel?: string
	/** Set while the submit's request runs. */
	pending?: boolean
	/** Layout placement only (w-full, shrink-0…). */
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function ResearchPill<T extends ElementType = 'button'>({
	tone,
	size,
	as,
	pendingLabel,
	pending = false,
	className,
	...props
}: ResearchPillProps<T>) {
	const classes =
		`inline-flex min-w-fit cursor-pointer items-center justify-center rounded-full border whitespace-nowrap ${GAP[size]} aria-busy:cursor-progress aria-disabled:not-aria-busy:cursor-not-allowed ${SIZE[size]} ${TONE[tone]} ${className ?? ''}`.trim()
	if (as) {
		const Component = as as ElementType
		return <Component className={classes} {...props} />
	}
	return (
		<Ariakit.Button
			{...props}
			className={classes}
			disabled={pending || props.disabled}
			accessibleWhenDisabled
			aria-busy={pending || undefined}
		>
			{/* Idle and busy content share one grid cell, so the pill keeps the wider of the two widths. */}
			<span className="grid gap-inherit">
				<span
					aria-hidden={pending || undefined}
					className={`col-start-1 row-start-1 flex items-center justify-center ${GAP[size]} ${pending ? 'invisible' : ''}`}
				>
					{props.children}
				</span>
				{pendingLabel === undefined ? null : pending ? (
					<span className="col-start-1 row-start-1 flex items-center justify-center gap-inherit">
						<BusyGlyph decorative size={14} />
						{pendingLabel}
					</span>
				) : (
					<ReservedLabel label={pendingLabel} icon />
				)}
			</span>
		</Ariakit.Button>
	)
}
