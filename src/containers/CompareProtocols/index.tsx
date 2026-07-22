import { useQueries } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import * as React from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { MultiSelectCombobox } from '~/components/Select/MultiSelectCombobox'
import { fetchProtocolTvlChart } from '~/containers/ProtocolOverview/api'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { FailedDataPopover } from '~/ui/FailedDataPopover'
import { LoadingIndicator, PanelStatus } from '~/ui/Status'
import { pushShallowQuery } from '~/utils/routerQuery'
import { buildCompareProtocolsChartData, type CompareProtocolTvlCharts } from './chartData'
import {
	buildCompareProtocolTvlRequestPlan,
	getCompareProtocolExtraTvlKeys,
	getCompareProtocolTvlSettings
} from './requestPlan'
import type { CompareProtocolsProps } from './types'

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>

export function CompareProtocols({ protocols, protocolsList }: CompareProtocolsProps) {
	const router = useRouter()

	const [extraTvlEnabled] = useLocalStorageSettingsManager('tvl')

	const { protocol: protocolQuery } = router.query

	const selectedProtocols = React.useMemo(() => {
		return protocolQuery ? (typeof protocolQuery === 'string' ? [protocolQuery] : [...protocolQuery]) : []
	}, [protocolQuery])
	const compareTvlSettings = React.useMemo(() => getCompareProtocolTvlSettings(extraTvlEnabled), [extraTvlEnabled])
	const extraTvlKeys = React.useMemo(() => getCompareProtocolExtraTvlKeys(compareTvlSettings), [compareTvlSettings])

	const baseResults = useQueries({
		queries: selectedProtocols.map((protocol) => {
			const requestPlan = buildCompareProtocolTvlRequestPlan(protocol)
			return {
				queryKey: requestPlan.queryKey,
				queryFn: () => fetchProtocolTvlChart({ protocol: requestPlan.protocolSlug }),
				staleTime: 60 * 60 * 1000,
				refetchOnWindowFocus: false,
				retry: 0
			}
		})
	})
	const extraResults = useQueries({
		queries: selectedProtocols.flatMap((protocol) =>
			extraTvlKeys.map((key) => {
				const requestPlan = buildCompareProtocolTvlRequestPlan(protocol, key)
				return {
					queryKey: requestPlan.queryKey,
					queryFn: () => fetchProtocolTvlChart({ protocol: requestPlan.protocolSlug, key }),
					staleTime: 60 * 60 * 1000,
					refetchOnWindowFocus: false,
					retry: 0
				}
			})
		)
	})

	const isLoading = baseResults.some((r) => r.isLoading) || extraResults.some((r) => r.isLoading)
	const failedSources = React.useMemo(() => {
		const failed: string[] = []
		for (let index = 0; index < baseResults.length; index++) {
			if (baseResults[index]?.error) failed.push(`${selectedProtocols[index]} - TVL`)
		}
		for (let index = 0; index < extraResults.length; index++) {
			if (!extraResults[index]?.error) continue
			const protocol = selectedProtocols[Math.floor(index / extraTvlKeys.length)]
			const key = extraTvlKeys[index % extraTvlKeys.length]
			failed.push(`${protocol} - ${key}`)
		}
		return failed
	}, [baseResults, extraResults, selectedProtocols, extraTvlKeys])

	const { dataset, charts } = React.useMemo(() => {
		const protocolCharts: CompareProtocolTvlCharts[] = []
		for (let protocolIndex = 0; protocolIndex < selectedProtocols.length; protocolIndex++) {
			const tvlChart = baseResults[protocolIndex]?.data
			if (!tvlChart) continue
			const extraTvlCharts: CompareProtocolTvlCharts['extraTvlCharts'] = {}
			for (let keyIndex = 0; keyIndex < extraTvlKeys.length; keyIndex++) {
				extraTvlCharts[extraTvlKeys[keyIndex]] =
					extraResults[protocolIndex * extraTvlKeys.length + keyIndex]?.data ?? null
			}
			protocolCharts.push({ name: selectedProtocols[protocolIndex], tvlChart, extraTvlCharts })
		}
		return buildCompareProtocolsChartData({ protocolCharts, extraTvlEnabled: compareTvlSettings })
	}, [baseResults, extraResults, selectedProtocols, extraTvlKeys, compareTvlSettings])

	const { selectedProtocolsData, selectedProtocolsNames } = React.useMemo(() => {
		if (selectedProtocols.length === 0) {
			return { selectedProtocolsData: [], selectedProtocolsNames: [] }
		}

		const selectedProtocolSet = new Set(selectedProtocols)
		const selectedProtocolByName = new Map<string, (typeof protocols)[number]>()
		for (const protocol of protocols) {
			if (selectedProtocolSet.has(protocol.name) && !selectedProtocolByName.has(protocol.name)) {
				selectedProtocolByName.set(protocol.name, protocol)
			}

			for (const child of protocol.childProtocols ?? []) {
				if (selectedProtocolSet.has(child.name) && !selectedProtocolByName.has(child.name)) {
					selectedProtocolByName.set(child.name, child)
				}
			}
		}

		const selectedProtocolsData: typeof protocols = []
		const selectedProtocolsNames: string[] = []
		for (const protocolName of selectedProtocols) {
			const protocol = selectedProtocolByName.get(protocolName)
			if (!protocol) continue
			selectedProtocolsData.push(protocol)
			selectedProtocolsNames.push(protocol.name)
		}

		return { selectedProtocolsData, selectedProtocolsNames }
	}, [selectedProtocols, protocols])

	return (
		<>
			<div className="w-full">
				<MultiSelectCombobox
					data={protocolsList}
					placeholder="Select Protocols..."
					selectedValues={selectedProtocolsNames}
					setSelectedValues={(values) => {
						void pushShallowQuery(router, { protocol: values.length > 0 ? values : undefined })
					}}
				/>
			</div>
			{selectedProtocols.length > 1 ? (
				<div className="relative flex flex-col gap-2">
					<ChartPanel>
						{isLoading || !router.isReady ? (
							<ChartPanelExportShellFallback className="flex h-full w-full items-center justify-center">
								<LoadingIndicator />
							</ChartPanelExportShellFallback>
						) : (
							<React.Suspense fallback={<ChartPanelExportShellFallback />}>
								<MultiSeriesChart
									dataset={dataset}
									charts={charts}
									valueSymbol="$"
									showTotalInTooltip
									exportButtons={{
										png: true,
										csv: true,
										filename: 'compare-protocols',
										pngTitle: 'Protocol TVL Comparison'
									}}
								/>
							</React.Suspense>
						)}
						<FailedDataPopover items={failedSources} ariaLabel="Show failed protocol chart APIs" />
					</ChartPanel>

					{selectedProtocolsData.length > 0 ? (
						<div>
							<ChainProtocolsTable
								protocols={selectedProtocolsData}
								useStickyHeader={false}
								tvlSettings={compareTvlSettings}
								suppressTvlStrike
							/>
						</div>
					) : null}
				</div>
			) : (
				<PanelStatus variant="empty">Select at least 2 protocols to compare</PanelStatus>
			)}
		</>
	)
}
