import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithRef } from 'react'
import { Button } from '~/ui/Button'
import { nestedMenuActionStyles } from '~/ui/Popover'

/** In the phone filter menu the reset is the menu's closing action row; on desktop it is a toolbar button.
    Clearing the filters disables the reset itself, so it stays focusable while disabled and swallows presses. It
    forwards the rest of its props, so a Tooltip can render it as its anchor. */
export function ResetFiltersButton({
	nestedMenu,
	disabled,
	className,
	...props
}: { nestedMenu: boolean } & Omit<ComponentPropsWithRef<'button'>, 'type'>) {
	return nestedMenu ? (
		<Ariakit.Button
			{...props}
			disabled={disabled}
			accessibleWhenDisabled
			className={`${nestedMenuActionStyles} ${className ?? ''}`.trim()}
		/>
	) : (
		<Button {...props} size="md" disabled={disabled} accessibleWhenDisabled className={className} />
	)
}
