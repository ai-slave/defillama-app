import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithRef } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'
import { Input, searchFieldIconStyles } from './Input'

type SearchFieldProps = {
	/** The accessible name; the search icon and placeholder stand in for a visible label. */
	label: string
	value: string
	onChange: (value: string) => void
	/** Layout placement only, on the wrapper (w-full, max-w-*). */
	className?: string
} & Omit<ComponentPropsWithRef<'input'>, 'className' | 'value' | 'onChange' | 'type' | 'aria-label'>

/** A search field: a 16px search icon, the Input recipe, an accessible `label`, and a small ghost × once there is
    text. Clearing moves focus back to the field, because the button that had it disappears. `autoFocus` goes through
    Ariakit, so a dialog starts on the field instead of its ×; pickers pass `autoFocus={!isSmallScreen}`. Never
    hand-roll a clear button beside a search input. */
export function SearchField({ label, value, onChange, className, autoFocus, ...props }: SearchFieldProps) {
	return (
		<div className={`relative ${className ?? ''}`.trim()}>
			<Icon name="search" height={16} width={16} className={searchFieldIconStyles} aria-hidden="true" />
			<Ariakit.Focusable
				// On the Focusable, not the input: Ariakit's dialog picks its first focus from the Focusable's flag.
				autoFocus={autoFocus}
				render={
					<Input
						type="text"
						inputMode="search"
						enterKeyHint="search"
						aria-label={label}
						value={value}
						onChange={(event) => onChange(event.currentTarget.value)}
						className={`w-full pl-8 ${value ? 'pr-9' : ''}`}
						{...props}
					/>
				}
			/>
			{value ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					square
					aria-label="Clear search"
					className="absolute top-1/2 right-1.5 -translate-y-1/2"
					onClick={(event) => {
						onChange('')
						event.currentTarget.parentElement?.querySelector('input')?.focus()
					}}
				>
					<Icon name="x" className="size-3.5" aria-hidden="true" />
				</Button>
			) : null}
		</div>
	)
}
