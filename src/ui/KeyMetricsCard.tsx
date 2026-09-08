import type { ReactNode } from 'react'
import { Icon } from '~/ui/Icon'
import { Watermark } from '~/ui/Watermark'

interface KeyMetricsHeaderProps {
	title?: string
	/** Anchor id; when set the heading gets a hover-revealed self link. */
	id?: string
	/** Right-aligned action, e.g. the PNG export button. */
	action?: ReactNode
}

/** Title row shared by every Key Metrics card so heading size and action placement match across pages. */
export function KeyMetricsHeader({ title = 'Key Metrics', id, action }: KeyMetricsHeaderProps) {
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
			{action}
		</div>
	)
}

/** Footer row: optional left content (e.g. report button) and the DefiLlama mark always bottom-right. */
export function KeyMetricsFooter({ children }: { children?: ReactNode }) {
	return (
		<div className="mt-auto flex items-center justify-between gap-2">
			{children ?? <span />}
			<Watermark />
		</div>
	)
}
