import type { ComponentPropsWithRef, ElementType } from 'react'

/**
 * Card — the surface for repeated content and data: bg-surface, border-subtle, 8px radius. Every new card uses it.
 * `Card` and `Panel` share the same outer chrome; `Panel` adds chart/table header and body structure, not a stronger
 * border. `border-medium` belongs to controls, inputs and overlays, never to page cards.
 *
 * `padding` is required and an enum, not a free value:
 * - sm (p-2): dense stat and data cards, and information, methodology and notes cards.
 * - strip (px-4 py-3): summary strips such as InlineStatStrip.
 * - md (p-4): roomy detail cards, only where the content needs the extra inset.
 * - none: embedded tables and charts that bring their own layout.
 * Never add responsive padding such as `xl:p-4`.
 *
 * `radius="large"` (12px) is reserved for unlock event cards; never use it as a generic drift patch. Any other radius
 * exception is a new primitive choice here, not a page-local `rounded-*`.
 *
 * `tone` is the featured fill: a card that offers something beside plain data cards (a builder, an upsell, a report
 * download). brand is the featured tint and warning a caution; each tone's border is its muted step, so the card stays
 * one object. A product's own colour comes from a scope that re-points the brand tokens around the card
 * (`.ai-violet-accent` for LlamaAI), never a product tone here. A plain data card never takes a tone.
 *
 * `className` is for layout placement only (grid column, margins, flex behavior); never pass visual overrides (bg-*,
 * border-*, rounded-*, p-*, hover/focus colors, type styles). A hoverable or focusable card uses `.hover-wash-card`,
 * which stacks a card-strength wash over bg-surface instead of replacing it.
 *
 * Information and methodology cards: `gap-3`, a heading-xs heading, body-md content. Metadata labels are
 * `label-md text-secondary` with `text-primary` values; run-in labels ("TVL:", adapter titles) are
 * `font-medium text-secondary` before a `text-primary` sentence. Action links inside are neutral `Button size="md"`
 * with 12px gaps, never blue outline or link styling.
 */
type CardProps<T extends ElementType> = {
	as?: T
	padding: 'none' | 'sm' | 'md' | 'strip'
	radius?: 'default' | 'large'
	tone?: keyof typeof TONE
} & Omit<ComponentPropsWithRef<T>, 'as' | 'padding'>

const PADDING = {
	none: '',
	sm: ' p-2',
	md: ' p-4',
	strip: ' px-4 py-3'
} as const

const TONE = {
	plain: 'border-subtle bg-surface',
	brand: 'border-brand-muted bg-brand-faint',
	warning: 'border-warning-muted bg-warning-faint'
} as const

const RADIUS = {
	default: 'rounded-lg',
	large: 'rounded-xl'
} as const

export function Card<T extends ElementType = 'div'>({
	as,
	padding,
	radius = 'default',
	tone = 'plain',
	className,
	...props
}: CardProps<T>) {
	const Tag = (as ?? 'div') as ElementType
	return (
		<Tag
			// A launcher card is a plain button, never a form's submit.
			{...(as === 'button' ? { type: 'button' } : {})}
			className={`${RADIUS[radius]} border ${TONE[tone]}${PADDING[padding]}${className ? ` ${className}` : ''}`}
			{...props}
		/>
	)
}
