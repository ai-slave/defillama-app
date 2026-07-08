import * as Ariakit from '@ariakit/react'
import { useMemo } from 'react'
import { buttonStyles } from '~/ui/Button'
import {
	legacyMenuSurfaceStyles,
	legacyPopoverExternalRowStyles,
	legacyPopoverRowStyles,
	menuSurfaceStyles,
	popoverRowWithBorderStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { Icon } from './Icon'
import { BasicLink } from './Link'

interface IMenuProps {
	options: string[] | string
	name: string
	isExternal?: boolean
	onItemClick?: (value: string) => void
	className?: string
	portal?: boolean
	popoverVariant?: 'default' | 'legacy'
}

export function Menu({
	options,
	name,
	isExternal,
	onItemClick,
	className,
	portal,
	popoverVariant,
	...props
}: IMenuProps) {
	const { _options } = useMemo(() => {
		return {
			_options: typeof options === 'string' ? [options] : options
		}
	}, [options])
	const surfaceStyles = popoverVariant === 'legacy' ? legacyMenuSurfaceStyles : menuSurfaceStyles
	const rowStyles = popoverVariant === 'legacy' ? legacyPopoverRowStyles : popoverRowWithBorderStyles
	const externalRowStyles =
		popoverVariant === 'legacy' ? legacyPopoverExternalRowStyles : `${popoverRowWithBorderStyles} block`
	const shouldPortalMenu = portal ?? true

	return (
		<Ariakit.MenuProvider>
			<Ariakit.MenuButton
				{...props}
				className={className ?? `${buttonStyles({ size: 'md' })} max-w-fit justify-between`}
			>
				{name}
				<Ariakit.MenuButtonArrow />
			</Ariakit.MenuButton>
			<Ariakit.Menu
				unmountOnHide
				hideOnInteractOutside
				gutter={8}
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={surfaceStyles}
				portal={shouldPortalMenu}
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>

				{_options.map((value, i) =>
					onItemClick ? (
						<Ariakit.MenuItem
							key={value + i}
							onClick={() => onItemClick(value)}
							className={`${rowStyles} text-ellipsis whitespace-nowrap`}
						>
							{value}
						</Ariakit.MenuItem>
					) : isExternal ? (
						<Ariakit.MenuItem
							render={<a href={value} target="_blank" rel="noopener noreferrer" />}
							key={value + i}
							className={externalRowStyles}
						>
							{value}
						</Ariakit.MenuItem>
					) : (
						<Ariakit.MenuItem
							key={value + i}
							render={<BasicLink href={value} />}
							className={`${rowStyles} text-ellipsis whitespace-nowrap`}
						>
							{value}
						</Ariakit.MenuItem>
					)
				)}
			</Ariakit.Menu>
		</Ariakit.MenuProvider>
	)
}
