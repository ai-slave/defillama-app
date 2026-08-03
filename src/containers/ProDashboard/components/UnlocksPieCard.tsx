import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useContext, useMemo } from 'react'
import { getProtocolEmissionsPieData } from '~/containers/Unlocks/queries'
import { slug } from '~/utils'
import { downloadCSV } from '~/utils/download'
import { StreamDoneContext } from '../queries'
import type { UnlocksPieConfig } from '../types'
import { CSVExportButton } from './CSVExportButton'
import { LoadingSpinner } from './LoadingSpinner'

const PieChart = lazy(() => import('~/components/ECharts/PieChart'))

const LOCKED_UNLOCKED_COLORS = {
	Unlocked: '#0c5dff',
	Locked: '#ff4e21'
}

const EMPTY_PIE_DATA: Array<{ name: string; value: number }> = []

interface UnlocksPieCardProps {
	config: UnlocksPieConfig
}

export function UnlocksPieCard({ config }: UnlocksPieCardProps) {
	const { protocol, protocolName, chartType } = config
	const includeSupplyMeta = chartType === 'locked-unlocked'

	const streamDone = useContext(StreamDoneContext)
	const { data, isLoading } = useQuery({
		queryKey: ['pro-dashboard', 'unlocks-pie', protocol, includeSupplyMeta],
		queryFn: () => getProtocolEmissionsPieData(slug(protocol), includeSupplyMeta),
		enabled: streamDone && Boolean(protocol),
		staleTime: 60 * 60 * 1000
	})

	const chartData = useMemo(() => {
		if (chartType === 'allocation') {
			const source = data?.pieChartData?.documented ?? EMPTY_PIE_DATA
			const result: Array<{ name: string; value: number }> = []
			for (const item of source) {
				if (item.name && item.value > 0) result.push(item)
			}
			return result
		}

		const totalLocked = data?.meta?.totalLocked
		const maxSupply = data?.meta?.maxSupply
		if (totalLocked == null || maxSupply == null || maxSupply === 0) return EMPTY_PIE_DATA
		const unlocked = Math.min(100, Math.max(0, 100 - (totalLocked / maxSupply) * 100))
		return [
			{ name: 'Unlocked', value: unlocked },
			{ name: 'Locked', value: 100 - unlocked }
		]
	}, [chartType, data])

	const stackColors = chartType === 'allocation' ? (data?.stackColors?.documented ?? {}) : LOCKED_UNLOCKED_COLORS
	const chartTitle = chartType === 'allocation' ? 'Allocation' : 'Locked/Unlocked %'
	const valueSymbol = chartType === 'locked-unlocked' ? '%' : '$'
	const hasChartData = chartData.length > 0
	const csvFileName = `${protocolName || protocol}-unlocks-${chartType}`

	const handleCsvExport = useCallback(() => {
		if (!hasChartData) return
		const rows = [['Category', 'Value'], ...chartData.map((item) => [item.name, String(item.value)])]
		downloadCSV(csvFileName, rows)
	}, [chartData, csvFileName, hasChartData])

	if (isLoading || (!streamDone && data === undefined)) {
		return (
			<div className="flex h-full min-h-[360px] items-center justify-center">
				<LoadingSpinner />
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col p-2">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-pro-text-primary">{chartTitle}</h3>
					<p className="text-xs text-pro-text-secondary">{protocolName}</p>
				</div>
				{hasChartData ? (
					<div className="flex gap-2">
						<CSVExportButton
							onClick={handleCsvExport}
							smol
							className="flex items-center gap-1 rounded-md border border-pro-form-control-border px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-primary focus-visible:border-transparent focus-visible:not-disabled:pro-btn-primary disabled:border-pro-cards-border disabled:text-tertiary"
						/>
					</div>
				) : null}
			</div>
			<div className="flex-1">
				{hasChartData ? (
					<Suspense
						fallback={
							<div className="flex h-[320px] items-center justify-center">
								<LoadingSpinner />
							</div>
						}
					>
						<PieChart chartData={chartData} stackColors={stackColors} valueSymbol={valueSymbol} />
					</Suspense>
				) : (
					<p className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
						No unlocks data.
					</p>
				)}
			</div>
		</div>
	)
}
