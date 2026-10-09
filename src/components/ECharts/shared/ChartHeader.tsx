import type { ReactNode } from 'react'
import { ChartPanelTitle, ChartPanelToolbar } from '~/ui/ChartPanel'

interface ChartHeaderProps {
	title?: string | undefined
	/** One line under the title in the same leading block, so title, subtitle and export buttons share one row. */
	subtitle?: ReactNode | undefined
	/** A definition too long for the subtitle, read from a "?" beside the title. */
	titleTooltip?: string | undefined
	headingAs?: 'h1' | 'h2' | 'h3' | undefined
	customComponents?: React.ReactNode | undefined
	exportButtons?: React.ReactNode | undefined
	className?: string | undefined
}

export function ChartHeader({
	title,
	subtitle,
	titleTooltip,
	headingAs: HeadingTag = 'h2',
	customComponents,
	exportButtons,
	className
}: ChartHeaderProps) {
	return title || customComponents || exportButtons ? (
		<ChartPanelToolbar
			className={className ?? 'justify-end'}
			leading={
				title ? (
					<ChartPanelTitle subtitle={subtitle} titleTooltip={titleTooltip} headingAs={HeadingTag}>
						{title}
					</ChartPanelTitle>
				) : null
			}
		>
			{customComponents ?? null}
			{exportButtons ?? null}
		</ChartPanelToolbar>
	) : null
}
