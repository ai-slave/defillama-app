import type { ReactNode } from 'react'
import { Button } from '~/ui/Button'
import { nestedMenuActionStyles } from '~/ui/Popover'

/** In the phone filter menu the reset is the menu's closing action row; on desktop it is a toolbar button. */
export function ResetFiltersButton({
	nestedMenu,
	onClick,
	disabled,
	children
}: {
	nestedMenu: boolean
	onClick: () => void
	disabled?: boolean
	children: ReactNode
}) {
	return nestedMenu ? (
		<button type="button" onClick={onClick} disabled={disabled} className={nestedMenuActionStyles}>
			{children}
		</button>
	) : (
		<Button type="button" size="md" onClick={onClick} disabled={disabled}>
			{children}
		</Button>
	)
}
