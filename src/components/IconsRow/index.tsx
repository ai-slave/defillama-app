import { useMemo, useRef } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { useResize } from '~/hooks/useResize'
import { Hovercard } from '~/ui/Hovercard'
import { Logo } from '~/ui/Logo'
import { Tooltip } from '~/ui/Tooltip'
import { letterLogoDataUri } from '~/utils/icons'
import { keyedOccurrences } from '~/utils/keyedOccurrences'

const ICON_WIDTH = 24
const MAX_ROW_WIDTH = 280

export interface IconsRowItem {
	label: string
	kind: 'chain' | 'token'
	href?: string
	title?: string
	size?: number
	/** Explicit logo URL for items whose label can't resolve an icon by name; null falls back to a letter avatar. */
	src?: string | null
}

interface IIconItemLogoProps {
	item: IconsRowItem
}

function IconItemLogo({ item }: IIconItemLogoProps) {
	const title = item.title ?? item.label
	const logoTitle = item.href ? undefined : title
	const logo =
		item.src !== undefined ? (
			<Logo
				src={item.src}
				fallbackSrc={letterLogoDataUri(item.label)}
				alt={`Logo of ${item.label}`}
				title={logoTitle}
				size={item.size ?? 24}
			/>
		) : (
			<TokenLogo
				name={item.label}
				kind={item.kind}
				alt={`Logo of ${item.label}`}
				{...(logoTitle !== undefined ? { title: logoTitle } : {})}
				{...(item.size !== undefined ? { size: item.size } : {})}
			/>
		)

	if (!item.href) return logo

	return (
		<Tooltip
			content={title}
			render={
				<a
					href={item.href}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={title}
					className="flex"
					onClick={(e) => e.stopPropagation()}
				/>
			}
		>
			{logo}
		</Tooltip>
	)
}

interface IIconsRowProps {
	items: Array<IconsRowItem>
	align?: 'start' | 'end'
}

const EMPTY_ITEMS: Array<IconsRowItem> = []

export function IconsRow({ items = EMPTY_ITEMS, align = 'end' }: IIconsRowProps) {
	const mainWrapEl = useRef<HTMLDivElement>(null)
	const { width: mainWrapWidth, ref: measureRow } = useResize(mainWrapEl)

	const { visibleItems, hiddenItems } = useMemo(() => {
		const keyedItems = keyedOccurrences(items, (item) => JSON.stringify([item.kind, item.label, item.href]))
		let remainingWidth = Math.min(mainWrapWidth, MAX_ROW_WIDTH) - ICON_WIDTH
		let visibleItemCount = 0

		for (const _ of items) {
			if (remainingWidth < 0) break
			remainingWidth -= ICON_WIDTH
			visibleItemCount += 1
		}

		visibleItemCount = items.length > 2 ? visibleItemCount : items.length
		const overflowStartIndex = visibleItemCount < items.length ? Math.max(visibleItemCount - 1, 0) : visibleItemCount

		const visibleItems = items.length > 2 ? keyedItems.slice(0, overflowStartIndex) : keyedItems
		const hiddenItems = overflowStartIndex !== visibleItemCount ? keyedItems.slice(overflowStartIndex) : []

		return { visibleItems, hiddenItems }
	}, [items, mainWrapWidth])

	return (
		<div
			className={`flex items-center ${align === 'start' ? 'justify-start' : 'justify-end'} overflow-hidden bg-none`}
			ref={measureRow}
		>
			{visibleItems.map(({ item, key }) => (
				<IconItemLogo key={key} item={item} />
			))}
			{hiddenItems.length > 0 && items.length > 2 ? (
				<Hovercard
					render={
						<button
							type="button"
							className="min-h-6 min-w-6 justify-center rounded-full bg-surface-elevated-2 px-1 label-sm text-primary"
						/>
					}
					content={
						// Ten 24px logos to a row: the card hugs a few and wraps a long list instead of growing past the row.
						<div className="flex max-w-69 flex-wrap items-center gap-1">
							{hiddenItems.map(({ item, key }) => (
								<IconItemLogo key={key} item={item} />
							))}
						</div>
					}
				>
					{`+${hiddenItems.length}`}
				</Hovercard>
			) : null}
		</div>
	)
}
