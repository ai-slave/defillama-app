import * as Ariakit from '@ariakit/react'
import { type ReactElement, useMemo } from 'react'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { Button } from './Button'
import { popoverRowWithBorderStyles } from './internal/Popover'
import { MenuSurface } from './PopoverSurface'

/* Menu — a button that opens a list of strings: external URLs that open in a new tab (`isExternal`, several websites or
   audit links behind one button), or values handed to `onItemClick`. */

interface IMenuProps {
	options: Array<string> | string
	name: string
	/** Each value is a URL opened in a new tab; otherwise each value goes to `onItemClick`. */
	isExternal?: boolean
	getItemAttributes?: (value: string) => Record<string, string>
	onItemClick?: (value: string) => void
	/** Layout placement of the default md Button trigger only (min-w-[100px], w-full, …). */
	className?: string
	/** A trigger that is not a button, such as a page title that switches entities. */
	render?: ReactElement
	portal?: boolean
}

export function Menu({
	options,
	name,
	isExternal,
	getItemAttributes,
	onItemClick,
	className,
	render,
	portal,
	...props
}: IMenuProps) {
	const { _options } = useMemo(() => {
		return {
			_options: keyedOccurrences(typeof options === 'string' ? [options] : options, (value) => value)
		}
	}, [options])
	const shouldPortalMenu = portal ?? true

	return (
		<Ariakit.MenuProvider>
			<Ariakit.MenuButton
				{...props}
				render={render ?? <Button size="md" className={`max-w-fit justify-between ${className ?? ''}`} />}
			>
				{name}
				<Ariakit.MenuButtonArrow />
			</Ariakit.MenuButton>
			<MenuSurface variant="panel" heading={name} hideOnInteractOutside portal={shouldPortalMenu}>
				{_options.map(({ item: value, key }) =>
					isExternal ? (
						<Ariakit.MenuItem
							render={<a href={value} target="_blank" rel="noopener noreferrer" {...getItemAttributes?.(value)} />}
							key={key}
							className={`${popoverRowWithBorderStyles} block`}
						>
							{value}
						</Ariakit.MenuItem>
					) : (
						<Ariakit.MenuItem
							key={key}
							onClick={() => onItemClick(value)}
							className={`${popoverRowWithBorderStyles} text-ellipsis whitespace-nowrap`}
						>
							{value}
						</Ariakit.MenuItem>
					)
				)}
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}
