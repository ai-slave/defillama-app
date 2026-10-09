import type { ComponentPropsWithRef, ElementType } from 'react'

/* ----------------------------------------------------------------------------
   GoldCta — LlamaAI's gold call to action, and the only one: the nav's Ask
   LlamaAI links (desktop label, mobile icon square), the /ai landing CTAs and
   its Ask submit, and onboarding's Show me around.

   The gold is a gradient with a glow and a shimmer on hover (`.llamaai-glow`
   in src/styles/llamaai.css), which a brand token scope cannot carry, so it is
   this one component rather than a Button variant. It keeps the Button
   scale: md (32px, label-sm) beside a field or in the nav, lg (44px,
   label-md) for a standalone CTA, and `square` lg (44x44) for the mobile
   header icon, level with the onBrand squares beside it. Hover never lifts
   or scales the button; a press darkens it like Button primary.

   Renders a button (type="button") by default; pass `as` for a link or a
   placeholder span. A placeholder that waits on auth takes `aria-disabled`
   and dims. `className` is layout placement only (w-full, lg:hidden…).
---------------------------------------------------------------------------- */

const SIZE = {
	md: 'min-h-8 gap-1 px-3 py-1.5 label-sm',
	lg: 'min-h-11 gap-1.5 px-4 py-2.5 label-md'
} as const

const SQUARE_SIZE = {
	md: 'aspect-square min-h-8 self-center p-1.5',
	lg: 'aspect-square min-h-11 self-center p-2.5'
} as const

type GoldCtaProps<T extends ElementType> = {
	as?: T
	size: 'md' | 'lg'
	square?: boolean
	/** Layout placement only. */
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function GoldCta<T extends ElementType = 'button'>({
	as,
	size,
	square = false,
	className,
	...props
}: GoldCtaProps<T>) {
	const Component = (as ?? 'button') as ElementType
	return (
		<Component
			{...(as ? {} : { type: 'button' })}
			className={`llamaai-glow touch-target relative flex min-w-fit shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-transparent whitespace-nowrap text-ai-on-gold-strong not-aria-disabled:active:brightness-90 aria-disabled:cursor-default aria-disabled:opacity-60 ${square ? SQUARE_SIZE[size] : SIZE[size]} ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}
