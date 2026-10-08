import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react'
import { tw } from '~/ui/tw'

/* ProButton exists only for Pro's create and generate CTAs: the soft light-blue `primary` tint (create a
   dashboard or card) and the soft purple `ai` tint (generate with LlamaAI). Every other Pro control is
   src/ui Button. */

const PRO_BUTTON_BASE = tw`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent whitespace-nowrap transition-[color,background-color,border-color,translate,scale] duration-120 ease-out-quart active:translate-y-px active:scale-[.985]`

const PRO_BUTTON_VARIANTS = {
	primary: tw`bg-pro-create text-pro-on-create hover:bg-pro-create-hover`,
	ai: tw`bg-pro-generate text-pro-on-generate hover:bg-pro-generate-hover`
}

// The same type styles, heights and radius (rounded-lg) as src/ui Button's md and lg, so a ProButton sits level with the Buttons in its row.
// Only the tint differs. Keep these in step with Button's SIZE_CLASSES.
const PRO_BUTTON_SIZES = {
	md: tw`min-h-8 gap-1 px-3 py-1.5 label-sm`,
	lg: tw`min-h-11 gap-1.5 px-4 py-2.5 label-md`
}

type ProButtonProps<T extends ElementType> = {
	/** A link or other host keeps its own element and role; only the default button takes button behaviour. */
	as?: T
	variant: keyof typeof PRO_BUTTON_VARIANTS
	size?: keyof typeof PRO_BUTTON_SIZES
	icon?: ReactNode
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function ProButton<T extends ElementType = 'button'>({
	as,
	variant,
	size = 'md',
	icon,
	children,
	...props
}: ProButtonProps<T>) {
	const Component = (as ?? Ariakit.Button) as ElementType
	return (
		<Component {...props} className={`${PRO_BUTTON_BASE} ${PRO_BUTTON_SIZES[size]} ${PRO_BUTTON_VARIANTS[variant]}`}>
			{icon}
			{children as ReactNode}
		</Component>
	)
}
