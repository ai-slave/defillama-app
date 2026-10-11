import type { ReactNode } from 'react'
import { ChartPanel, ChartPanelTitle, ChartPanelToolbar } from '~/ui/ChartPanel'

export function CexChartPanel({
	title,
	controls,
	children
}: {
	title: ReactNode
	controls?: ReactNode
	children: ReactNode
}) {
	return (
		<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar leading={<ChartPanelTitle headingAs="h2">{title}</ChartPanelTitle>}>
				{controls}
			</ChartPanelToolbar>
			{children}
		</ChartPanel>
	)
}
