import * as Ariakit from '@ariakit/react'
import type { Ref } from 'react'
import type * as React from 'react'
import type { ArticleDocument } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'

type EditorialTagRowProps = {
	article: ArticleDocument
	onRemove: () => void
	pending: boolean
	position?: number
	leading?: React.ReactNode
	className?: string
} & Omit<React.ComponentPropsWithoutRef<'li'>, 'className'>

export function EditorialTagRow({
	ref,
	article,
	onRemove,
	pending,
	position,
	leading,
	className,
	...rest
}: EditorialTagRowProps & { ref?: Ref<HTMLLIElement> }) {
	const defaultClassName = leading
		? 'grid gap-3 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center'
		: 'grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center'

	return (
		<li ref={ref} className={className ?? defaultClassName} {...rest}>
			{leading ? (
				<div className="flex items-center gap-2 sm:col-start-1">
					{leading}
					{position != null ? (
						<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary tabular-nums">#{position}</span>
					) : null}
				</div>
			) : null}
			<div className={`grid min-w-0 gap-1${leading ? ' sm:col-start-2' : ''}`}>
				<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">
					{article.section ? ARTICLE_SECTION_LABELS[article.section] : 'No section'} · /{article.slug}
				</span>
				<span className="truncate text-sm text-primary">{article.title}</span>
			</div>
			<Ariakit.Button
				type="button"
				onClick={onRemove}
				disabled={pending}
				accessibleWhenDisabled
				className={`justify-self-end rounded-md px-3 py-1.5 text-xs text-error transition-colors hover:bg-error/10 aria-disabled:opacity-50${leading ? ' sm:col-start-3' : ''}`}
			>
				Remove
			</Ariakit.Button>
		</li>
	)
}
