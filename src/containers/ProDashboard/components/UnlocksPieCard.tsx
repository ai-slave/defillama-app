import { useQuery } from '@tanstack/react-query'
import { lazy, type ReactNode, Suspense, useCallback, useContext, useMemo } from 'react'
import { getProtocolEmissionsPieData } from '~/containers/Unlocks/queries'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { slug } from '~/utils'
import { downloadCSV } from '~/utils/download'
import { queryReadFailed } from '~/utils/query'
import { StreamDoneContext } from '../queries'
import type { UnlocksPieConfig } from '../types'
import { ProMeta } from '../ui'
import { BoundParameterBadge } from './BoundParameterBadge'
import { scaledPx, useCardHeightScale } from './cardHeightContext'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardRefreshFailed } from './ProCardStatus'

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
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const { protocol, protocolName, chartType } = config
	const includeSupplyMeta = chartType === 'locked-unlocked'

	const streamDone = useContext(StreamDoneContext)
	const pieQuery = useQuery({
		queryKey: ['pro-dashboard', 'unlocks-pie', protocol, includeSupplyMeta],
		queryFn: () => getProtocolEmissionsPieData(slug(protocol), includeSupplyMeta),
		enabled: streamDone && Boolean(protocol),
		staleTime: 60 * 60 * 1000
	})
	const { data, isLoading } = pieQuery
	const readFailed = queryReadFailed(pieQuery)

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

	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(320, cardHeightScale)

	const renderStatusShell = (status: ReactNode) => (
		<div className="flex h-full min-h-[calc(360px*var(--card-scale,1))] flex-col p-0">
			<ProCardHeader titleAs="h3" title={chartTitle} subtitle={<ProMeta items={[protocolName]} />} />
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3" style={{ minHeight: chartHeight }}>
				{status}
			</div>
		</div>
	)

	if (readFailed && data === undefined) {
		return renderStatusShell(<ProCardError retry={pieQuery} />)
	}

	if (isLoading || (!streamDone && data === undefined)) {
		return renderStatusShell(<ProCardLoading variant="pie" />)
	}

	return (
		<div className="flex h-full flex-col p-0">
			{readFailed ? <ProCardRefreshFailed retry={pieQuery} /> : null}
			<ProCardHeader
				titleAs="h3"
				title={chartTitle}
				badge={<BoundParameterBadge {...(config.bindings === undefined ? {} : { bindings: config.bindings })} />}
				subtitle={<ProMeta items={[protocolName]} />}
				menu={
					hasChartData
						? {
								image: { chartInstance, filename: csvFileName, title: chartTitle },
								csv: { onClick: handleCsvExport }
							}
						: {}
				}
			/>
			<div className="flex-1 px-3 pb-3">
				{hasChartData ? (
					<Suspense
						fallback={
							<div className="flex h-[calc(320px*var(--card-scale,1))] items-center justify-center">
								<ProCardLoading variant="pie" />
							</div>
						}
					>
						<PieChart
							onReady={handleChartReady}
							chartData={chartData}
							stackColors={stackColors}
							valueSymbol={valueSymbol}
							height={chartHeight}
						/>
					</Suspense>
				) : (
					<div className="flex h-[calc(320px*var(--card-scale,1))] flex-col justify-center">
						<ProCardEmpty message="No unlocks data." />
					</div>
				)}
			</div>
		</div>
	)
}
