import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithRef, ElementType, MouseEvent, ReactNode } from 'react'
import { LoadingSpinner } from '~/ui/Loaders'
import { tw } from '~/ui/tw'

export type ProButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ai' | 'danger'
export type ProButtonSize = 'sm' | 'md' | 'lg'

const PRO_BUTTON_BASE = tw`inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-[color,background-color,border-color,translate,scale] duration-120 ease-out-quart active:translate-y-px active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-none disabled:active:scale-none aria-busy:cursor-progress aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:active:translate-none aria-disabled:active:scale-none`

const PRO_BUTTON_VARIANTS: Record<ProButtonVariant, string> = {
	primary: tw`border border-transparent bg-pro-info-100 text-pro-info-400 hover:bg-pro-info-300/20 dark:bg-pro-info-300/20 dark:text-pro-info-200`,
	secondary: tw`border border-pro-cards-border bg-pro-cards-bg text-pro-text-primary hover:bg-pro-hover-fill`,
	ghost: tw`border border-transparent text-pro-text-secondary hover:bg-pro-hover-fill hover:text-pro-text-primary`,
	ai: tw`border border-transparent bg-pro-ai-100 text-pro-ai-400 hover:bg-pro-ai-300/20 dark:bg-pro-ai-300/20 dark:text-pro-ai-200`,
	danger: tw`border border-transparent text-error hover:bg-error/10`
}

const PRO_BUTTON_SIZES: Record<ProButtonSize, string> = {
	sm: tw`min-h-6 gap-1 px-2 py-0.5 text-xs`,
	md: tw`min-h-8 gap-1.5 px-3 py-1.5 text-sm`,
	lg: tw`min-h-10 gap-2 px-5 py-2 text-base`
}

const PRO_BUTTON_SQUARE_SIZES: Record<ProButtonSize, string> = {
	sm: tw`aspect-square min-h-6 justify-center p-0`,
	md: tw`aspect-square min-h-8 justify-center p-0`,
	lg: tw`aspect-square min-h-10 justify-center p-0`
}

export function proButtonStyles({
	variant = 'secondary',
	size = 'md',
	square = false
}: {
	variant?: ProButtonVariant
	size?: ProButtonSize
	square?: boolean
}): string {
	return `${PRO_BUTTON_BASE} rounded-md ${square ? PRO_BUTTON_SQUARE_SIZES[size] : PRO_BUTTON_SIZES[size]} ${PRO_BUTTON_VARIANTS[variant]}`
}

const PRO_BUTTON_SPINNER_SIZES: Record<ProButtonSize, number> = { sm: 12, md: 14, lg: 16 }

type ProButtonProps<T extends ElementType> = {
	/** A link or other host keeps its own element and role; only the default button takes button behaviour. */
	as?: T
	variant?: ProButtonVariant
	size?: ProButtonSize
	square?: boolean
	/** The request this button started is running: it shows a spinner, keeps focus and ignores presses. */
	loading?: boolean
	/** For a control that disables itself when pressed: it keeps focus while disabled. See ui/Button. */
	accessibleWhenDisabled?: boolean
	'aria-disabled'?: boolean | 'true' | 'false'
	icon?: ReactNode
	className?: string | undefined
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

/** Pro's own button skin on the same behaviour as ui/Button: Ariakit's Button, disabled leaves the tab order, and
    `loading` or `accessibleWhenDisabled` keep it focusable while swallowing presses. */
export function ProButton<T extends ElementType = 'button'>({
	as,
	variant = 'secondary',
	size = 'md',
	square = false,
	loading = false,
	accessibleWhenDisabled = false,
	'aria-disabled': ariaDisabled,
	icon,
	className,
	children,
	...props
}: ProButtonProps<T>) {
	const classes = `${proButtonStyles({ variant, size, square })} ${className ?? ''}`.trim()
	const content = (
		<>
			{loading ? <LoadingSpinner size={PRO_BUTTON_SPINNER_SIZES[size]} /> : icon}
			{children as ReactNode}
		</>
	)
	if (as) {
		const Component = as as ElementType
		// A loading link keeps its role, so it is marked busy and swallows its own click instead.
		return (
			<Component
				className={classes}
				aria-disabled={loading || ariaDisabled}
				aria-busy={loading || undefined}
				{...props}
				{...(loading ? { onClick: (event: MouseEvent) => event.preventDefault() } : {})}
			>
				{content}
			</Component>
		)
	}
	return (
		<Ariakit.Button
			className={classes}
			{...props}
			aria-disabled={ariaDisabled}
			disabled={loading || props.disabled}
			// A host that renders this button (render={<ProButton />}) marks "disabled but focusable" with aria-disabled.
			accessibleWhenDisabled={
				loading || accessibleWhenDisabled || (!props.disabled && (ariaDisabled === true || ariaDisabled === 'true'))
			}
			aria-busy={loading || undefined}
		>
			{content}
		</Ariakit.Button>
	)
}
