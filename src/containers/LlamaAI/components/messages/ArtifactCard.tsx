import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react'
import { Card } from '~/ui/Card'
import type { IIcon } from '~/ui/Icon'
import { IconTile } from '~/ui/IconTile'

/* ----------------------------------------------------------------------------
   ArtifactCard — a file or dashboard attached to a chat message: an exported
   document to download, a file the reader sent, the dashboard the answer
   built. Every attachment card is this one recipe: Card's surface (8px,
   border-subtle, bg-surface, the card wash on hover), one 56px height, a
   32px brand IconTile, the title over a meta line, and an optional
   trailing hint (the file type, an external-link or panel chevron).

   Renders a button (type="button") by default; pass `as` for a link or an
   Ariakit Button. A card whose action runs takes `aria-busy` and says so in
   `meta`. `className` is layout placement only (w-full, a width cap).
---------------------------------------------------------------------------- */

type ArtifactCardProps<T extends ElementType> = {
	as?: T
	icon: IIcon['name']
	title: ReactNode
	meta?: ReactNode
	trailing?: ReactNode
	/** Layout placement only. */
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className' | 'title'>

export function ArtifactCard<T extends ElementType = 'button'>({
	as,
	icon,
	title,
	meta,
	trailing,
	className,
	...props
}: ArtifactCardProps<T>) {
	const Component = (as ?? 'button') as ElementType
	return (
		<Card
			as={Component}
			{...(as ? {} : { type: 'button' })}
			padding="sm"
			className={`hover-wash-card flex min-h-14 cursor-pointer items-center gap-3 text-left aria-busy:cursor-progress ${className ?? ''}`.trim()}
			{...props}
		>
			<IconTile icon={icon} tone="brand" size="sm" />
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="truncate label-md text-primary">{title}</span>
				{meta ? <span className="truncate body-sm text-secondary">{meta}</span> : null}
			</span>
			{trailing}
		</Card>
	)
}
