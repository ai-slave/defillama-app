import type { ReactNode } from 'react'
import { Panel } from '~/ui/Panel'
import { ChartPanelToolbar } from '~/ui/Toolbar'

export const cexChartFallback = <div className="min-h-[360px]" />

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
		<Panel padding="none" className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
			<ChartPanelToolbar className="justify-end">
				<h2 className="mr-auto heading-xs">{title}</h2>
				{controls}
			</ChartPanelToolbar>
			{children}
		</Panel>
	)
}
