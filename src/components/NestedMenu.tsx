import * as Ariakit from '@ariakit/react'
import { buttonStyles } from '~/ui/Button'
import {
	legacyNestedMenuButtonStyles,
	legacyNestedMenuRootButtonStyles,
	legacyNestedMenuRootFilterButtonStyles,
	legacyNestedMenuSurfaceStyles,
	menuSurfaceStyles,
	popoverRowStyles
} from '~/ui/Popover'
import { Icon } from './Icon'

interface NestedMenuItemProps extends Ariakit.MenuItemProps {
	ref?: React.Ref<HTMLDivElement>
}

export function NestedMenuItem({ ref, ...props }: NestedMenuItemProps) {
	return <Ariakit.MenuItem ref={ref} {...props} className={props.className ?? ''} />
}

interface NestedMenuProps extends Ariakit.MenuButtonProps<'div'> {
	label: React.ReactNode
	menuPortal?: boolean
	buttonVariant?: 'default' | 'filter'
	popoverVariant?: 'default' | 'legacy'
	ref?: React.Ref<HTMLDivElement>
}

export function NestedMenu({
	label,
	children,
	ref,
	menuPortal = false,
	buttonVariant = 'default',
	popoverVariant = 'default',
	...props
}: NestedMenuProps) {
	const menu = Ariakit.useMenuStore()
	const shouldPortalMenu = menuPortal || Boolean(menu.parent)

	const useLegacyPopover = popoverVariant === 'legacy'
	const rootButtonClassName = useLegacyPopover
		? buttonVariant === 'filter'
			? legacyNestedMenuRootFilterButtonStyles
			: legacyNestedMenuRootButtonStyles
		: buttonVariant === 'filter'
			? buttonStyles({ size: 'sm' })
			: buttonStyles({ size: 'md' })
	const nestedButtonClassName = useLegacyPopover ? legacyNestedMenuButtonStyles : popoverRowStyles
	const surfaceStyles = useLegacyPopover ? legacyNestedMenuSurfaceStyles : menuSurfaceStyles

	return (
		<Ariakit.MenuProvider store={menu}>
			<Ariakit.MenuButton
				ref={ref}
				{...props}
				className={`${!menu.parent ? rootButtonClassName : nestedButtonClassName} ${props.className ?? ''}`}
				render={menu.parent ? <NestedMenuItem hideOnClick={false} render={props.render} /> : undefined}
			>
				<span className="label">{label}</span>
				<Ariakit.MenuButtonArrow />
			</Ariakit.MenuButton>
			<Ariakit.Menu
				unmountOnHide
				hideOnInteractOutside
				gutter={menu.parent ? 4 : 8}
				shift={menu.parent ? -9 : 0}
				portal={shouldPortalMenu}
				wrapperProps={{
					className:
						'max-sm:fixed! max-sm:right-0! max-sm:bottom-0! max-sm:left-0! max-sm:top-[unset]! max-sm:transform-none! max-sm:w-full!'
				}}
				className={`${surfaceStyles} ${menu.parent ? 'z-20' : 'z-10'} ${
					menu.parent ? 'max-sm:drawer-to-left' : 'max-sm:drawer'
				}`}
			>
				{menu.parent ? (
					<div className="grid grid-cols-[auto_1fr_auto] items-center p-2 sm:hidden">
						<button
							type="button"
							className="flex size-8 items-center justify-center rounded-md"
							onClick={() => {
								menu.hide()
							}}
							aria-label="Back to parent menu"
						>
							<Icon name="chevron-left" height={20} width={20} />
						</button>
						<Ariakit.MenuHeading className="text-center text-base font-medium">{label}</Ariakit.MenuHeading>
						<Ariakit.MenuDismiss className="flex size-8 items-center justify-center rounded-md">
							<Icon name="x" height={20} width={20} />
							<span className="sr-only">Close menu</span>
						</Ariakit.MenuDismiss>
					</div>
				) : (
					<Ariakit.MenuDismiss className="ml-auto px-3 py-1 sm:hidden">
						<Icon name="x" height={16} width={16} />
						<span className="sr-only">Close menu</span>
					</Ariakit.MenuDismiss>
				)}
				{children}
			</Ariakit.Menu>
		</Ariakit.MenuProvider>
	)
}
