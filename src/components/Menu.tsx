import * as Ariakit from '@ariakit/react'
import { useMemo } from 'react'
import { buttonStyles } from '~/ui/Button'
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
	className?: string
	portal?: boolean
}

export function Menu({
	options,
	name,
	isExternal,
	getItemAttributes,
	onItemClick,
	className,
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
				className={className ?? `${buttonStyles({ size: 'md' })} max-w-fit justify-between`}
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
