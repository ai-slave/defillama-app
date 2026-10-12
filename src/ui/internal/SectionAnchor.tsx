import { Icon } from '../Icon'

/** A heading's self link: the whole heading links to `#id`, and a link icon shows on hover. The
    heading supplies `group relative flex items-center gap-1` and the `id`. The link is hidden from readers and the tab
    order, because the heading already names the section and the page's own nav reaches it, so nothing here takes focus. */
export function SectionAnchor({ id }: { id: string }) {
	return (
		<>
			<a
				aria-hidden="true"
				tabIndex={-1}
				href={`#${id}`}
				className="absolute top-0 right-0 z-10 flex size-full items-center"
			/>
			<Icon name="link" className="invisible size-3.5 group-hover:visible" />
		</>
	)
}
