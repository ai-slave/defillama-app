import { ChartPanelToolbar } from '~/ui/ChartPanel'

interface ChartHeaderProps {
	title?: string
	headingAs?: 'h1' | 'h2' | 'h3'
	customComponents?: React.ReactNode
	exportButtons?: React.ReactNode
	className?: string
}

export function ChartHeader({
	title,
	headingAs: HeadingTag = 'h2',
	customComponents,
	exportButtons,
	className
}: ChartHeaderProps) {
	return title || customComponents || exportButtons ? (
		<ChartPanelToolbar className={className ?? 'justify-end'}>
			{title ? <HeadingTag className="mr-auto heading-xs">{title}</HeadingTag> : null}
			{customComponents ?? null}
			{exportButtons ?? null}
		</ChartPanelToolbar>
	) : null
}
