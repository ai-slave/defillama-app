import type { ElementType } from 'react'

/**
 * Text the server may have rendered differently from the visitor's first render: a token price from an older cache,
 * a copyright year on a build-frozen page. It carries the one `suppressHydrationWarning` in the app, and only text
 * may be inside, because the flag covers an element's own text and nothing nested.
 *
 * React keeps the server's text until a later render changes the value; a value that is the same on every client
 * render, such as a local-zone time, stays as the server wrote it. Render such text after mount or in UTC instead.
 */
export function StaleText({
	as: Tag = 'span',
	className,
	children
}: {
	as?: ElementType
	className?: string
	children: string | number | null | undefined
}) {
	return (
		<Tag className={className} suppressHydrationWarning>
			{children}
		</Tag>
	)
}
