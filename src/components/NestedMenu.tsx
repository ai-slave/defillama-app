import * as Ariakit from '@ariakit/react'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import {
	legacyNestedMenuButtonStyles,
	legacyNestedMenuRootButtonStyles,
	legacyNestedMenuRootFilterButtonStyles,
	legacyNestedMenuSurfaceStyles,
	nestedPopoverMobileWrapperClassName,
	nestedMenuSurfaceStyles,
	nestedMenuDisclosureIconStyles,
	nestedMenuHeaderIconButtonStyles,
	nestedMenuRootFilterButtonStyles,
	nestedMenuRootRowStyles,
	popoverMobileDismissStyles
} from '~/ui/Popover'

interface NestedMenuItemProps extends Ariakit.MenuItemProps {
	ref?: React.Ref<HTMLDivElement>
}

export function NestedMenuItem({ ref, ...props }: NestedMenuItemProps) {
	return <Ariakit.MenuItem ref={ref} {...props} className={props.className ?? ''} />
}

interface NestedMenuProps extends Ariakit.MenuButtonProps<'div'> {
	label: React.ReactNode
	portal?: boolean
	buttonVariant?: 'default' | 'filter'
	popoverVariant?: 'default' | 'legacy'
	ref?: React.Ref<HTMLDivElement>
}

export function NestedMenu({
	label,
	children,
	ref,
	portal,
	buttonVariant = 'default',
	popoverVariant = 'default',
	...props
}: NestedMenuProps) {
	const menu = Ariakit.useMenuStore()
	const shouldPortalMenu = portal ?? true

	const useLegacyPopover = popoverVariant === 'legacy'
	const rootButtonClassName = useLegacyPopover
		? buttonVariant === 'filter'
			? legacyNestedMenuRootFilterButtonStyles
			: legacyNestedMenuRootButtonStyles
		: buttonVariant === 'filter'
			? nestedMenuRootFilterButtonStyles
			: buttonStyles({ size: 'md' })
	const nestedButtonClassName = useLegacyPopover ? legacyNestedMenuButtonStyles : nestedMenuRootRowStyles
	const surfaceStyles = useLegacyPopover ? legacyNestedMenuSurfaceStyles : nestedMenuSurfaceStyles
	const labelClassName = 'min-w-0 justify-self-start truncate text-left'

	return (
		<Ariakit.MenuProvider store={menu}>
			<Ariakit.MenuButton
				ref={ref}
				{...props}
				className={`${!menu.parent ? rootButtonClassName : nestedButtonClassName} ${props.className ?? ''}`}
				render={menu.parent ? <NestedMenuItem hideOnClick={false} render={props.render} /> : undefined}
			>
				<span className={labelClassName}>{label}</span>
				{menu.parent ? (
					<Icon name="chevron-right" className={nestedMenuDisclosureIconStyles} />
				) : (
					<span>
						<Ariakit.MenuButtonArrow className="size-4 shrink-0" />
					</span>
				)}
			</Ariakit.MenuButton>
			<Ariakit.Menu
				unmountOnHide
				hideOnInteractOutside
				gutter={menu.parent ? 4 : 8}
				shift={menu.parent ? -9 : 0}
				portal={shouldPortalMenu}
				wrapperProps={{
					className: nestedPopoverMobileWrapperClassName
				}}
				className={`${surfaceStyles} ${menu.parent ? 'z-20' : 'z-10'} ${
					menu.parent ? 'max-sm:drawer-to-left' : 'max-sm:drawer'
				}`}
			>
				{menu.parent ? (
					<div className="grid min-h-12 grid-cols-[2.5rem_1fr_2.5rem] items-center px-2 py-1 sm:hidden">
						<button
							type="button"
							className={nestedMenuHeaderIconButtonStyles}
							onClick={() => {
								menu.hide()
							}}
							aria-label="Back to parent menu"
						>
							<Icon name="chevron-left" className="size-4" />
						</button>
						<Ariakit.MenuHeading className="min-w-0 truncate text-center label-md text-primary">
							{label}
						</Ariakit.MenuHeading>
						<Ariakit.MenuDismiss className={nestedMenuHeaderIconButtonStyles}>
							<Icon name="x" className="size-4" />
							<span className="sr-only">Close menu</span>
						</Ariakit.MenuDismiss>
					</div>
				) : (
					<div className="flex min-h-12 items-center justify-end px-2 py-1 sm:hidden">
						<Ariakit.MenuDismiss className={popoverMobileDismissStyles}>
							<Icon name="x" className="size-4" />
							<span className="sr-only">Close menu</span>
						</Ariakit.MenuDismiss>
					</div>
				)}
				{children}
			</Ariakit.Menu>
		</Ariakit.MenuProvider>
	)
}
