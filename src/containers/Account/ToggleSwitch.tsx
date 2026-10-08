import * as Ariakit from '@ariakit/react'

interface ToggleSwitchProps {
	checked: boolean
	onClick?: () => void
	disabled?: boolean
	'aria-label': string
}

export function ToggleSwitch({ checked, onClick, disabled, 'aria-label': ariaLabel }: ToggleSwitchProps) {
	return (
		<Ariakit.Checkbox
			render={<button type="button" aria-label={ariaLabel} />}
			role="switch"
			aria-checked={checked}
			checked={checked}
			onChange={onClick}
			disabled={disabled}
			// A switch that locks while its own change runs keeps focus.
			accessibleWhenDisabled
			className={`flex w-10 cursor-pointer items-center rounded-full p-0.5 transition-colors ${checked ? 'justify-end' : ''} ${
				disabled ? 'cursor-not-allowed bg-disabled' : checked ? 'bg-brand' : 'bg-surface-elevated-2'
			}`}
		>
			<span className={`block size-5 rounded-full ${disabled ? 'bg-current text-disabled' : 'bg-white'}`} />
		</Ariakit.Checkbox>
	)
}
