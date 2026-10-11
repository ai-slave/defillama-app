import clsx from 'clsx'
import type { ComponentProps } from 'react'
import { BasicLink } from '~/components/Link'

/**
 * TextLink — an entity's name that opens its page, in a table cell, a list row or a key-value row: a protocol, chain,
 * token, exchange or author. Link blue at rest and underlined on hover, so a column of names reads as data until
 * pointed at. It renders BasicLink, so an internal href navigates client side and an external one (with the caller's
 * `target` and `rel`) is a plain anchor.
 *
 * `size` md (label-md, the default) is a name in a table cell or list row; sm (label-sm) a name in a compact row of
 * 12px metadata; inherit takes the row's own type (a key-value row's value, a metric label). `truncate` ends a long
 * name with an ellipsis where the link is a flex item or a block.
 *
 * Text only: a logo, an icon or a marker with a tooltip sits beside the link, never inside it, so the link's name is
 * the entity's name and no control nests in it. A link inside a sentence, or a text action aligned to a text edge
 * (See all, View profile, Verify), is `Button variant="link"`, underlined at rest; a source or reference is `TagLink`.
 * `className` is placement only.
 */
const SIZE_CLASSES = {
	md: 'label-md',
	sm: 'label-sm',
	inherit: ''
} as const

export function TextLink({
	size = 'md',
	truncate = false,
	className,
	...props
}: ComponentProps<typeof BasicLink> & { size?: keyof typeof SIZE_CLASSES; truncate?: boolean }) {
	return (
		<BasicLink
			{...props}
			className={clsx('text-link hover:underline', SIZE_CLASSES[size], truncate && 'truncate', className)}
		/>
	)
}
