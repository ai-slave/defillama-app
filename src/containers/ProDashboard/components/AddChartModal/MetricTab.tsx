import { useMemo } from 'react'
import { Icon } from '~/ui/Icon'
import { useAppMetadata } from '../../AppMetadataContext'
import { createMetricConfig } from '../../dashboardConfig/classicChartConfig'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import type { MetricAggregator, MetricChartType, MetricConfig, MetricSubject } from '../../types'
import { MetricCard } from '../MetricCard'
import { BoundParameterChip, useModalFieldBinding } from './bindingContext'
import { MetricSentenceBuilder } from './MetricSentenceBuilder'

type MetricTabProps = {
	metricSubjectType: 'chain' | 'protocol'
	metricChain: string | null
	metricProtocol: string | null
	metricType: string
	metricAggregator: MetricAggregator
	metricWindow: '7d' | '30d' | '90d' | '365d' | 'ytd' | '3y' | 'all'
	metricLabel: string
	metricChartType: MetricChartType
	onSubjectTypeChange: (t: 'chain' | 'protocol') => void
	onChainChange: (opt: { value: string; label: string }) => void
	onProtocolChange: (opt: { value: string; label: string }) => void
	onTypeChange: (t: string) => void
	onAggregatorChange: (a: MetricAggregator) => void
	onWindowChange: (w: '7d' | '30d' | '90d' | '365d' | 'ytd' | '3y' | 'all') => void
	onLabelChange: (s: string) => void
	onChartTypeChange: (v: MetricChartType) => void
}

export function MetricTab(props: MetricTabProps) {
	const {
		metricSubjectType,
		metricChain,
		metricProtocol,
		metricType,
		metricAggregator,
		metricWindow,
		metricLabel,
		metricChartType,
		onSubjectTypeChange,
		onChainChange,
		onProtocolChange,
		onTypeChange,
		onAggregatorChange,
		onWindowChange,
		onLabelChange,
		onChartTypeChange
	} = props

	const { protocols: protocolList, chains: chainList } = useProDashboardCatalog()

	const { availableProtocolChartTypes, availableChainChartTypes } = useAppMetadata()
	const subjectParameter = useModalFieldBinding('subject', metricSubjectType)

	const availableTypes = useMemo(() => {
		if (metricSubjectType === 'protocol' && metricProtocol) {
			const geckoId = protocolList.find((p) => p.slug === metricProtocol)?.geckoId
			return availableProtocolChartTypes(metricProtocol, { hasGeckoId: !!geckoId })
		}
		if (metricSubjectType === 'chain' && metricChain) {
			const geckoId = chainList.find((c) => c.name === metricChain)?.gecko_id
			return availableChainChartTypes(metricChain, { hasGeckoId: !!geckoId })
		}
		return []
	}, [
		metricSubjectType,
		metricProtocol,
		metricChain,
		protocolList,
		chainList,
		availableProtocolChartTypes,
		availableChainChartTypes
	])

	const selectedSubject = useMemo<MetricSubject | null>(() => {
		if (metricSubjectType === 'protocol' && metricProtocol) {
			const geckoId = protocolList.find((p) => p.slug === metricProtocol)?.geckoId
			const subject: MetricSubject = {
				itemType: 'protocol',
				protocol: metricProtocol,
				...(geckoId === undefined ? {} : { geckoId })
			}
			return subject
		}
		if (metricSubjectType === 'chain' && metricChain) {
			const geckoId = chainList.find((c) => c.name === metricChain)?.gecko_id
			const subject: MetricSubject = {
				itemType: 'chain',
				chain: metricChain,
				...(geckoId === undefined ? {} : { geckoId })
			}
			return subject
		}
		return null
	}, [metricSubjectType, metricProtocol, metricChain, protocolList, chainList])

	const previewMetric = useMemo<MetricConfig | null>(() => {
		if (!selectedSubject || !metricType) return null
		const base = {
			id: 'metric-preview',
			kind: 'metric' as const,
			aggregator: metricAggregator,
			window: metricWindow,
			compare: { mode: 'previous_value' as const, format: 'percent' as const },
			chartType: metricChartType,
			label: metricLabel
		}
		return createMetricConfig({ ...base, subject: selectedSubject, type: metricType })
	}, [selectedSubject, metricType, metricAggregator, metricWindow, metricChartType, metricLabel])

	return (
		<div className="flex h-full flex-col gap-3 lg:min-h-[360px] lg:flex-row lg:overflow-hidden">
			<div className="flex w-full shrink-0 flex-col border border-pro-cards-border lg:w-[380px] lg:shrink lg:overflow-y-auto xl:w-[420px]">
				<div className="flex flex-col gap-3 p-2.5 sm:p-3">
					<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-2.5 shadow-sm sm:p-3">
						<div className="flex items-start justify-between gap-2 sm:gap-3">
							<div>
								<div className="text-xs font-semibold text-pro-text-primary">Card name</div>
								<p className="text-xs text-pro-text-tertiary">Shown above the metric tile</p>
							</div>
							<div className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-brand/12 text-brand md:flex">
								<Icon name="pencil" width={14} height={14} />
							</div>
						</div>
						<div className="mt-2 space-y-1.5">
							<input
								type="text"
								value={metricLabel}
								onChange={(e) => onLabelChange(e.target.value)}
								placeholder="Optional"
								className="w-full rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2.5 py-1.5 text-sm text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-2 focus:ring-brand/40 focus:outline-hidden"
								maxLength={64}
							/>
							<div className="flex items-center justify-between text-xs text-pro-text-tertiary">
								<span>Leave blank to use the automatic title.</span>
								<span>{metricLabel.length}/64</span>
							</div>
						</div>
					</div>

					{subjectParameter.boundVariable ? (
						<BoundParameterChip label={subjectParameter.boundVariable.label} onUnbind={subjectParameter.unbind} />
					) : null}

					<MetricSentenceBuilder
						aggregator={metricAggregator}
						metricType={metricType}
						metricSubjectType={metricSubjectType}
						metricChain={metricChain}
						metricProtocol={metricProtocol}
						metricWindow={metricWindow}
						chartType={metricChartType}
						availableMetricTypes={availableTypes}
						chains={chainList}
						protocols={protocolList}
						onAggregatorChange={onAggregatorChange}
						onMetricTypeChange={onTypeChange}
						onSubjectTypeChange={onSubjectTypeChange}
						onChainChange={onChainChange}
						onProtocolChange={onProtocolChange}
						onWindowChange={onWindowChange}
						onChartTypeChange={onChartTypeChange}
					/>
				</div>
			</div>

			<div className="flex min-h-[280px] flex-1 shrink-0 flex-col overflow-hidden border border-pro-cards-border lg:min-h-0 lg:shrink">
				<div className="flex-1 overflow-hidden rounded-md bg-pro-cards-bg p-2 sm:p-2.5">
					{previewMetric ? (
						<MetricCard metric={previewMetric} />
					) : (
						<div className="flex h-full items-center justify-center text-xs text-pro-text-tertiary sm:text-sm">
							<div className="text-center">
								<Icon name="activity" height={28} width={28} className="mx-auto mb-1 sm:size-8" />
								<p>Select subject and metric to preview</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
