import { Children, cloneElement, isValidElement, type ComponentPropsWithoutRef } from 'react'

type ListItemProps = ComponentPropsWithoutRef<'li'>

export function MarkdownOrderedList({
	children,
	node: _node,
	...props
}: ComponentPropsWithoutRef<'ol'> & { node?: unknown }) {
	const items = Children.toArray(children).filter(isValidElement<ListItemProps>)
	let number = props.start ?? (props.reversed ? items.length : 1)
	const numberedItems = []
	for (const item of items) {
		const marker = item.props.value === undefined ? number : Number(item.props.value)
		number = marker + (props.reversed ? -1 : 1)
		numberedItems.push(
			cloneElement(item, {
				className: `col-span-2 grid grid-cols-subgrid pl-0 ${item.props.className ?? ''}`,
				children: (
					<>
						<span className="text-right text-secondary">{marker}.</span>
						<div className="min-w-0">{item.props.children}</div>
					</>
				)
			})
		)
	}

	return (
		<ol
			{...props}
			// oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari needs an explicit list role when list-style is none.
			role="list"
			className={`grid list-none grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-1 pl-0 ${props.className ?? ''}`}
		>
			{numberedItems}
		</ol>
	)
}
