import { useQueries } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import * as React from 'react'
import { MultiSelectCombobox } from '~/components/Select/MultiSelectCombobox'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { FailedDataNote } from '~/ui/ScopeNote'
import { PanelStatus } from '~/ui/Status'
import { slug } from '~/utils'
import { pushShallowQuery } from '~/utils/routerQuery'
import { buildCompareProtocolsChartData, type CompareProtocolTvlCharts } from './chartData'
import {
	buildCompareProtocolTvlQuery,
	getCompareProtocolExtraTvlKeys,
	getCompareProtocolTvlSettings,
	normalizeCompareProtocolSelection
} from './requestPlan'
import type { CompareProtocolsProps } from './types'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

export function CompareProtocols({ protocols, protocolsList }: CompareProtocolsProps) {
	const router = useRouter()

	const [extraTvlEnabled] = useLocalStorageSettingsManager('tvl')

	const { protocol: protocolQuery } = router.query
	const protocolNameBySlug = React.useMemo(() => {
		const names = new Map<string, string>()
		for (const protocol of protocolsList) {
			const protocolSlug = slug(protocol.value)
			if (protocolSlug && !names.has(protocolSlug)) names.set(protocolSlug, protocol.value)
		}
		return names
	}, [protocolsList])

	const selectedProtocols = React.useMemo(() => {
		return normalizeCompareProtocolSelection(protocolQuery, protocolNameBySlug)
	}, [protocolQuery, protocolNameBySlug])
	const compareTvlSettings = React.useMemo(() => getCompareProtocolTvlSettings(extraTvlEnabled), [extraTvlEnabled])
	const extraTvlKeys = React.useMemo(() => getCompareProtocolExtraTvlKeys(compareTvlSettings), [compareTvlSettings])

	const baseResults = useQueries({
		queries: selectedProtocols.map((protocol) => {
			return {
				...buildCompareProtocolTvlQuery(protocol),
				staleTime: 60 * 60 * 1000,
				refetchOnWindowFocus: false,
				retry: 0
			}
		})
	})
	const extraResults = useQueries({
		queries: selectedProtocols.flatMap((protocol) =>
			extraTvlKeys.map((key) => {
				return {
					...buildCompareProtocolTvlQuery(protocol, key),
					staleTime: 60 * 60 * 1000,
					refetchOnWindowFocus: false,
					retry: 0
				}
			})
		)
	})

	const isLoading = baseResults.some((r) => r.isLoading) || extraResults.some((r) => r.isLoading)
	const failedSources = React.useMemo(() => {
		const failed: Array<string> = []
		for (const [protocolIndex, protocol] of selectedProtocols.entries()) {
			if (baseResults[protocolIndex]?.error) failed.push(`${protocol} - TVL`)
		}
		for (const [protocolIndex, protocol] of selectedProtocols.entries()) {
			for (const [keyIndex, key] of extraTvlKeys.entries()) {
				const resultIndex = protocolIndex * extraTvlKeys.length + keyIndex
				if (extraResults[resultIndex]?.error) failed.push(`${protocol} - ${key}`)
			}
		}
		return failed
	}, [baseResults, extraResults, selectedProtocols, extraTvlKeys])

	const { dataset, charts } = React.useMemo(() => {
		const protocolCharts: Array<CompareProtocolTvlCharts> = []
		for (const [protocolIndex, protocolName] of selectedProtocols.entries()) {
			const tvlChart = baseResults[protocolIndex]?.data ?? null
			const extraTvlCharts: CompareProtocolTvlCharts['extraTvlCharts'] = {}
			for (const [keyIndex, key] of extraTvlKeys.entries()) {
				extraTvlCharts[key] = extraResults[protocolIndex * extraTvlKeys.length + keyIndex]?.data ?? null
			}
			protocolCharts.push({ name: protocolName, tvlChart, extraTvlCharts })
		}
		return buildCompareProtocolsChartData({ protocolCharts, extraTvlEnabled: compareTvlSettings })
	}, [baseResults, extraResults, selectedProtocols, extraTvlKeys, compareTvlSettings])

	const selectedProtocolsData = React.useMemo(() => {
		if (selectedProtocols.length === 0) {
			return []
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
		for (const protocolName of selectedProtocols) {
			const protocol = selectedProtocolByName.get(protocolName)
			if (!protocol) continue
			selectedProtocolsData.push(protocol)
		}

		return selectedProtocolsData
	}, [selectedProtocols, protocols])

	return (
		<>
			<div className="w-full">
				<MultiSelectCombobox
					heading="Protocols"
					data={protocolsList}
					placeholder="Select protocols…"
					selectedValues={selectedProtocols}
					setSelectedValues={(values) => {
						void pushShallowQuery(router, { protocol: values.length > 0 ? values : undefined })
					}}
				/>
			</div>
			{selectedProtocols.length > 1 ? (
				<div className="relative flex flex-col gap-2">
					<Panel>
						<FailedDataNote labels={failedSources} shows="The chart shows the other protocols." />
						{isLoading || !router.isReady ? (
							<ChartPanelExportShellLoading />
						) : (
							<React.Suspense fallback={<ChartPanelExportShellLoading />}>
								<MultiSeriesChart
									dataset={dataset}
									charts={charts}
									valueSymbol="$"
									exportButtons={
										dataset.source.length > 0
											? {
													png: true,
													csv: true,
													filename: 'compare-protocols',
													pngTitle: 'Protocol TVL Comparison'
												}
											: 'hidden'
									}
								/>
							</React.Suspense>
						)}
					</Panel>

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
