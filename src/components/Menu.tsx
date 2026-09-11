import * as Ariakit from '@ariakit/react'
import { useMemo } from 'react'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import {
	legacyMenuSurfaceStyles,
	legacyPopoverExternalRowStyles,
	legacyPopoverRowStyles,
	menuSurfaceStyles,
	popoverRowWithBorderStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { BasicLink } from './Link'

interface IMenuProps {
	options: Array<string> | string
	name: string
	isExternal?: boolean
	getItemAttributes?: (value: string) => Record<string, string>
	onItemClick?: (value: string) => void
	className?: string
	portal?: boolean
	popoverVariant?: 'default' | 'legacy'
}

export function Menu({
	options,
	name,
	isExternal,
	getItemAttributes,
	onItemClick,
	className,
	portal,
	popoverVariant,
	...props
}: IMenuProps) {
	const { _options } = useMemo(() => {
		return {
			_options: keyedOccurrences(typeof options === 'string' ? [options] : options, (value) => value)
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
				<Ariakit.PopoverDismiss aria-label="Close menu" className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>

				{_options.map(({ item: value, key }) =>
					onItemClick ? (
						<Ariakit.MenuItem
							key={key}
							onClick={() => onItemClick(value)}
							className={`${rowStyles} text-ellipsis whitespace-nowrap`}
						>
							{value}
						</Ariakit.MenuItem>
					) : isExternal ? (
						<Ariakit.MenuItem
							render={<a href={value} target="_blank" rel="noopener noreferrer" {...getItemAttributes?.(value)} />}
							key={key}
							className={externalRowStyles}
						>
							{value}
						</Ariakit.MenuItem>
					) : (
						<Ariakit.MenuItem
							key={key}
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
