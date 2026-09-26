import type { ReactNode, Ref } from 'react'
import { Icon } from '~/ui/Icon'
import { Watermark } from '~/ui/Watermark'

interface KeyMetricsPanelProps {
	/** Anchor id; when set the heading gets a hover-revealed self link. */
	id?: string
	/** The rows' container, which the PNG export measures. */
	rowsRef?: Ref<HTMLDivElement>
	/** Buttons pinned to the card bottom; callers order them (csv or report left, PNG export right). */
	footer?: ReactNode
	children: ReactNode
}

/** The Key Metrics block of every overview card: the heading with the DefiLlama mark top-right, the rows, then the footer. */
export function KeyMetricsPanel({ id, rowsRef, footer, children }: KeyMetricsPanelProps) {
	return (
		<div className="flex flex-1 flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<h2 className="group relative flex items-center gap-1 font-semibold" id={id}>
					Key Metrics
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
			<div className="flex flex-col" ref={rowsRef}>
				{children}
			</div>
			{footer ? <div className="mt-auto flex items-center justify-between gap-2">{footer}</div> : null}
		</div>
	)
}
