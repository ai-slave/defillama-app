import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { forwardRef, useState } from 'react'

const CHECKBOX_WRAPPER_VARIANTS = {
	default:
		'group flex cursor-pointer flex-nowrap items-center gap-3 rounded-md px-3 py-2 body-sm text-primary hover:bg-hover-row data-focus-visible:bg-hover-row data-focus-visible:focus-ring',
	inline: 'group flex cursor-pointer flex-nowrap items-center gap-2 label-md text-secondary',
	filter:
		'group relative flex min-h-8 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-lg border border-medium px-3 py-1.5 label-sm text-primary hover:bg-hover-row data-focus-visible:bg-hover-row data-focus-visible:focus-ring',
	'filter-borderless':
		'group relative flex cursor-pointer flex-row-reverse flex-nowrap items-center justify-between gap-4 rounded-md px-3 py-2 body-sm text-primary hover:bg-hover-row data-focus-visible:bg-hover-row data-focus-visible:focus-ring'
} as const

const CHECKBOX_INDICATOR_STYLES =
	'grid size-3.5 shrink-0 place-items-center rounded-[4px] border border-strong bg-transparent text-transparent group-hover:border-medium data-[checked=true]:border-brand data-[checked=true]:bg-brand data-[checked=true]:text-on-brand'

interface CheckboxProps extends ComponentPropsWithoutRef<'input'> {
	children?: ReactNode
	variant: keyof typeof CHECKBOX_WRAPPER_VARIANTS
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
	{ children, variant, ...props },
	ref
) {
	const [checked, setChecked] = useState(props.checked ?? props.defaultChecked ?? false)
	const [focusVisible, setFocusVisible] = useState(false)
	const isChecked = props.checked ?? checked

	return (
		<label
			className={CHECKBOX_WRAPPER_VARIANTS[variant]}
			data-checked={isChecked}
			data-focus-visible={focusVisible || undefined}
		>
			<Ariakit.VisuallyHidden>
				<Ariakit.Checkbox
					{...props}
					ref={ref}
					clickOnEnter
					onFocusVisible={() => setFocusVisible(true)}
					onBlur={() => setFocusVisible(false)}
					onChange={(event) => {
						setChecked(event.target.checked)
						props.onChange?.(event)
					}}
				/>
			</Ariakit.VisuallyHidden>
			<div className={CHECKBOX_INDICATOR_STYLES} data-checked={isChecked}>
				{isChecked ? (
					<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 14 14" height="0.875rem" width="0.875rem">
						<polyline points="3,7 5.75,9.75 11,4.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				) : null}
			</div>
			{children}
		</label>
	)
})
