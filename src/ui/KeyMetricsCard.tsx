import type { ReactNode, Ref } from 'react'
import { Icon } from '~/ui/Icon'
import { Watermark } from '~/ui/Watermark'

interface KeyMetricsPanelProps {
	/** Anchor id; when set the heading gets a hover-revealed self link. */
	id?: string
	/** The rows' container, which the PNG export measures. */
	rowsRef?: Ref<HTMLDivElement>
	/** Buttons pinned to the card bottom, all size sm; callers order them (csv or report left, PNG export right). */
	footer?: ReactNode
	/** The heading's level, h2 by default: lower it where the block sits under a deeper heading of the page. */
	headingAs?: 'h1' | 'h2' | 'h3' | 'h4' | undefined
	children: ReactNode
}

/** The Key Metrics block of every overview card (summary variant 1 in ./SummaryStats.tsx): the title-md "Key Metrics"
    heading (h2, or `headingAs`) with the DefiLlama mark top-right, the MetricRow/MetricSection rows, then the footer
    pinned to the card bottom (csv or report button left, PNG export right; a lone button sits left; every footer
    button is size sm so the row stays one height). Every Key Metrics block renders through it, token, equity and RWA
    pages included; never hand-roll the heading, mark or footer. */
export function KeyMetricsPanel({ id, rowsRef, footer, headingAs: Heading = 'h2', children }: KeyMetricsPanelProps) {
	return (
		<div className="flex flex-1 flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<Heading className="group relative flex items-center gap-1 title-md" id={id}>
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
				</Heading>
				<Watermark />
			</div>
			<div className="flex flex-col" ref={rowsRef}>
				{children}
			</div>
			{footer ? <div className="mt-auto flex items-center justify-between gap-2">{footer}</div> : null}
		</div>
	)
}
