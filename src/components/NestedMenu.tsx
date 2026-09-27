import * as Ariakit from '@ariakit/react'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { MenuSurface } from '~/ui/MenuSurface'
import {
	nestedMenuDisclosureIconStyles,
	nestedMenuHeaderIconButtonStyles,
	nestedMenuRootFilterButtonStyles,
	nestedMenuRootRowStyles
} from '~/ui/Popover'
import { DrawerDismiss } from '~/ui/PopoverSurface'

interface NestedMenuItemProps extends Ariakit.MenuItemProps {
	ref?: React.Ref<HTMLDivElement>
}

export function NestedMenuItem({ ref, ...props }: NestedMenuItemProps) {
	return <Ariakit.MenuItem ref={ref} {...props} className={props.className ?? ''} />
}

interface NestedMenuProps extends Ariakit.MenuButtonProps<'div'> {
	label: React.ReactNode
	combobox?: Ariakit.MenuStoreProps['combobox']
	buttonVariant?: 'default' | 'filter'
}

export function NestedMenu({ label, children, combobox, buttonVariant = 'default', ...props }: NestedMenuProps) {
	const menu = Ariakit.useMenuStore({ combobox })

	const rootButtonClassName =
		buttonVariant === 'filter' ? nestedMenuRootFilterButtonStyles : buttonStyles({ size: 'md' })
	const labelClassName = 'min-w-0 justify-self-start truncate text-left'

	return (
		<Ariakit.MenuProvider store={menu}>
			<Ariakit.MenuButton
				{...props}
				className={`${!menu.parent ? rootButtonClassName : nestedMenuRootRowStyles} ${props.className ?? ''}`}
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
			<MenuSurface
				variant={menu.parent ? 'nested' : 'list'}
				dismiss="own"
				hideOnInteractOutside
				gutter={menu.parent ? 4 : 8}
				shift={menu.parent ? -9 : 0}
				className={menu.parent ? 'z-20' : 'z-10'}
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
						<Ariakit.MenuDismiss onClick={() => menu.hideAll()} className={nestedMenuHeaderIconButtonStyles}>
							<Icon name="x" className="size-4" />
							<span className="sr-only">Close menu</span>
						</Ariakit.MenuDismiss>
					</div>
				) : (
					<div className="flex min-h-12 items-center justify-end px-2 py-1 sm:hidden">
						<DrawerDismiss label="Close menu" />
					</div>
				)}
				{children}
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}
