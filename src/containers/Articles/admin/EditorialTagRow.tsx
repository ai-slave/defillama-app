import type { Ref } from 'react'
import type * as React from 'react'
import type { ArticleDocument } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'
import { Button } from '~/ui/Button'
import { neighbourRowControl, passFocusOnLeave } from '~/ui/focus'

// A removed row takes its Remove with it: the next row's Remove takes focus, else the section's article picker.
const focusNeighbourOnLeave = passFocusOnLeave(
	(node) => neighbourRowControl(node.closest('li')!, node) ?? node.closest('section')?.querySelector('input')
)

type EditorialTagRowProps = {
	article: ArticleDocument
	onRemove: () => void
	/** Any editorial request runs: every row's Remove waits. */
	pending: boolean
	/** This row's removal runs. */
	removing: boolean
	position?: number
	leading?: React.ReactNode
	className?: string
} & Omit<React.ComponentPropsWithoutRef<'li'>, 'className'>

export function EditorialTagRow({
	ref,
	article,
	onRemove,
	pending,
	removing,
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
			<Button
				ref={focusNeighbourOnLeave}
				variant="secondary"
				size="sm"
				onClick={onRemove}
				pendingLabel={removing ? 'Removing…' : null}
				disabled={pending}
				accessibleWhenDisabled
				className={`justify-self-end${leading ? ' sm:col-start-3' : ''}`}
			>
				Remove
			</Button>
		</li>
	)
}
