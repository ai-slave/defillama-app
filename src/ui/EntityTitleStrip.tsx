import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/* A standalone page title surface for an entity, not a panel header: a 28px logo slot, the heading-sm title and an
   optional right-side action slot on a padded card. Never use PanelHeader for this. The title is the page's h1;
   `headingAs` lowers it where the strip sits under a deeper heading of the page. */

type EntityTitleStripProps = {
	media?: ReactNode
	title: ReactNode
	actions?: ReactNode
	className?: string
	headingAs?: 'h1' | 'h2' | 'h3' | 'h4' | undefined
} & Omit<ComponentPropsWithoutRef<'section'>, 'children' | 'className' | 'title'>

export function EntityTitleStrip({
	media,
	title,
	actions,
	className,
	headingAs: Heading = 'h1',
	...props
}: EntityTitleStripProps) {
	return (
		<section
			className={`flex min-w-0 items-center gap-3 rounded-lg border border-subtle bg-surface p-2 ${
				className ?? ''
			}`.trim()}
			{...props}
		>
			{media ? (
				<div className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full">{media}</div>
			) : null}
			<Heading className="min-w-0 flex-1 truncate heading-sm">{title}</Heading>
			{actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
		</section>
	)
}
