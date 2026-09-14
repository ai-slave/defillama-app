import type { ComponentPropsWithRef, ElementType } from 'react'
import { tw } from '~/ui/tw'

const PRO_CHIP_STYLES = tw`inline-flex items-center gap-1 rounded-full border border-pro-cards-border px-2.5 py-0.5 text-xs text-pro-text-secondary transition-[color,border-color,scale] duration-120 ease-out-quart hover:border-pro-accent/40 hover:text-pro-text-primary`

const PRO_CHIP_INTERACTIVE_STYLES = tw`cursor-pointer active:scale-[.985] disabled:active:scale-none aria-disabled:active:scale-none`

type ProChipProps<T extends ElementType> = {
	as?: T
	className?: string | undefined
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function ProChip<T extends ElementType = 'span'>({ as, className, ...props }: ProChipProps<T>) {
	const Component = (as ?? 'span') as ElementType
	const interactive = Component === 'button' || Component === 'a'
	return (
		<Component
			className={`${PRO_CHIP_STYLES} ${interactive ? PRO_CHIP_INTERACTIVE_STYLES : ''} ${className ?? ''}`
				.replace(/\s+/g, ' ')
				.trim()}
			{...props}
		/>
	)
}
