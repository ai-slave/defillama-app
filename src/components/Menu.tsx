import * as Ariakit from '@ariakit/react'
import { type ReactElement, useMemo } from 'react'
import { Button } from '~/ui/Button'
import { MenuSurface } from '~/ui/MenuSurface'
import { popoverRowWithBorderStyles } from '~/ui/Popover'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { BasicLink } from './Link'

interface IMenuProps {
	options: Array<string> | string
	name: string
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
	const externalRowStyles = `${popoverRowWithBorderStyles} block`
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
					onItemClick ? (
						<Ariakit.MenuItem
							key={key}
							onClick={() => onItemClick(value)}
							className={`${popoverRowWithBorderStyles} text-ellipsis whitespace-nowrap`}
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
