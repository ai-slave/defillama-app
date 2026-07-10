import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

type EntityTitleStripProps<T extends ElementType> = {
	as?: T
	media?: ReactNode
	title: ReactNode
	actions?: ReactNode
	className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className' | 'title'>

export function EntityTitleStrip<T extends ElementType = 'section'>({
	as,
	media,
	title,
	actions,
	className,
	...props
}: EntityTitleStripProps<T>) {
	const Component = (as ?? 'section') as ElementType

	return (
		<Component
			className={`flex min-w-0 items-center gap-3 rounded-lg border border-subtle bg-surface p-2 ${
				className ?? ''
			}`.trim()}
			{...props}
		>
			{media ? (
				<div className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full">{media}</div>
			) : null}
			<h1 className="min-w-0 flex-1 truncate heading-sm">{title}</h1>
			{actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
		</Component>
	)
}

export const PageTitleStrip = EntityTitleStrip
