import { chartPanelToolbarStyles } from '~/ui/Toolbar'

interface ChartHeaderProps {
	title?: string
	headingAs?: 'h1' | 'h2'
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
		<div className={className ?? `${chartPanelToolbarStyles} justify-end`}>
			{title ? <HeadingTag className="mr-auto heading-xs">{title}</HeadingTag> : null}
			{customComponents ?? null}
			{exportButtons ?? null}
		</div>
	) : null
}
