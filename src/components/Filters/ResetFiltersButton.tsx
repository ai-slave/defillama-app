import type { ComponentPropsWithRef } from 'react'
import { Button } from '~/ui/Button'
import { PopoverFooterAction } from '~/ui/PopoverSurface'

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
		<PopoverFooterAction {...props} inset="nested" disabled={disabled} accessibleWhenDisabled />
	) : (
		<Button {...props} size="md" disabled={disabled} accessibleWhenDisabled className={className} />
	)
}
