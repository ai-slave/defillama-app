import type { ReactNode } from 'react'
import { Icon } from '~/ui/Icon'
import { Watermark } from '~/ui/Watermark'

interface KeyMetricsHeaderProps {
	title?: string
	/** Anchor id; when set the heading gets a hover-revealed self link. */
	id?: string
}

/** Title row shared by every Key Metrics card; the DefiLlama mark sits top-right. */
export function KeyMetricsHeader({ title = 'Key Metrics', id }: KeyMetricsHeaderProps) {
	return (
		<div className="flex items-center justify-between gap-2">
			<h2 className="group relative flex items-center gap-1 font-semibold" id={id}>
				{title}
				{id ? (
					<>
						<a
							aria-hidden="true"
							tabIndex={-1}
							href={`#${id}`}
							className="absolute top-0 right-0 z-10 flex size-full items-center"
						/>
						<Icon name="link" className="invisible size-3.5 group-hover:visible group-focus-visible:visible" />
					</>
				) : null}
			</h2>
			<Watermark />
		</div>
	)
}

/** Footer row pinned to the card bottom; callers order the children (report button left, PNG export right). */
export function KeyMetricsFooter({ children }: { children: ReactNode }) {
	return <div className="mt-auto flex items-center justify-between gap-2">{children}</div>
}
