import * as Ariakit from '@ariakit/react'
import { useId, type ReactNode } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import {
	nestedMenuDisclosureIconStyles,
	nestedMenuRootRowStyles,
	nestedMenuSelectRowStyles,
	popoverMultiSelectCheckStyles
} from '~/ui/Popover'
import { DrawerDismiss, NestedDrawerHeader, MenuSurface } from '~/ui/PopoverSurface'

interface NestedMenuProps extends Ariakit.MenuButtonProps<'div'> {
	label: React.ReactNode
	combobox?: Ariakit.MenuStoreProps['combobox']
}

export function NestedMenu({ label, children, combobox, ...props }: NestedMenuProps) {
	const menu = Ariakit.useMenuStore({ combobox })

	const labelClassName = 'min-w-0 justify-self-start truncate text-left'

	return (
		<Ariakit.MenuProvider store={menu}>
			<Ariakit.MenuButton
				{...props}
				// A full-width root trigger keeps its arrow at the far edge.
				className={`${menu.parent ? nestedMenuRootRowStyles : 'justify-between'} ${props.className ?? ''}`}
				render={menu.parent ? <Ariakit.MenuItem hideOnClick={false} render={props.render} /> : <Button size="md" />}
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
				{...(menu.parent ? { variant: 'nested' as const } : { variant: 'list' as const, dismiss: 'own' as const })}
				hideOnInteractOutside
				gutter={menu.parent ? 4 : 8}
				shift={menu.parent ? -9 : 0}
			>
				{menu.parent ? (
					<NestedDrawerHeader
						title={label}
						backLabel="Back to parent menu"
						onBack={menu.hide}
						closeLabel="Close menu"
						onClose={menu.hideAll}
					/>
				) : (
					// pr-2 plus the close button's 8px inset puts the x on the 16px nested-row edge.
					<div className="flex min-h-12 items-center gap-2 pt-2 pr-2 pl-4 sm:hidden">
						<Ariakit.MenuHeading className="min-w-0 flex-1 truncate label-md text-primary">{label}</Ariakit.MenuHeading>
						<DrawerDismiss label="Close menu" />
					</div>
				)}
				{children}
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}

/** An on/off filter inside the phone filter menu: a check row the arrow keys reach, like the select rows. */
export function NestedMenuToggle({
	checked,
	onChange,
	children
}: {
	checked: boolean
	onChange: (checked: boolean) => void
	children: ReactNode
}) {
	const name = useId()
	return (
		<Ariakit.MenuItemCheckbox
			name={name}
			checked={checked}
			onChange={(event) => onChange(event.currentTarget.checked)}
			hideOnClick={false}
			className={nestedMenuSelectRowStyles}
		>
			<span className="flex min-w-0 items-center gap-2">{children}</span>
			<span className={popoverMultiSelectCheckStyles(checked)} aria-hidden>
				{checked ? <Icon name="check" className="size-3" aria-hidden /> : null}
			</span>
		</Ariakit.MenuItemCheckbox>
	)
}
