import type { ReactNode } from 'react'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'

export const cexChartFallback = <ChartPanelBodyFallback />

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
			<ChartPanelToolbar>
				<h2 className="mr-auto heading-xs">{title}</h2>
				{controls}
			</ChartPanelToolbar>
			{children}
		</ChartPanel>
	)
}
