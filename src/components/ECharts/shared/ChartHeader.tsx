import { ChartPanelToolbar } from '~/ui/ChartPanel'

interface ChartHeaderProps {
	title?: string | undefined
	headingAs?: 'h1' | 'h2' | 'h3' | undefined
	customComponents?: React.ReactNode | undefined
	exportButtons?: React.ReactNode | undefined
	className?: string | undefined
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
