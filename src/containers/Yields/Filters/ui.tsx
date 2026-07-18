import type { ReactNode } from 'react'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'

// Help affordances for structured definitions in the Yields control panel.

export function HelpIcon({ content, label }: { content: ReactNode; label?: string }) {
	return (
		<Hovercard
			content={content}
			// Anchor the panel's left edge to the glyph and grow rightward (not centered) so it never
			// overflows onto the left nav when the icon sits near the page edge.
			placement="top-start"
			className="text-tertiary hover:text-secondary"
			contentClassName="max-w-105 p-3"
			render={<button type="button" aria-label={label} />}
		>
			<Icon name="help-circle" height={14} width={14} />
		</Hovercard>
	)
}

export function HelpDefs({ items }: { items: { id: string; term: ReactNode; def: ReactNode }[] }) {
	return (
		<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
			{items.map((it) => (
				<div key={it.id} className="contents">
					<dt className="label-md whitespace-nowrap text-primary">{it.term}</dt>
					<dd className="body-md text-secondary">{it.def}</dd>
				</div>
			))}
		</dl>
	)
}
