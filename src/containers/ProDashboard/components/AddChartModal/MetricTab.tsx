import { useId, useMemo } from 'react'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { useAppMetadata } from '../../AppMetadataContext'
import { createMetricConfig } from '../../dashboardConfig/classicChartConfig'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import type { MetricAggregator, MetricChartType, MetricConfig, MetricSubject } from '../../types'
import { MetricCard } from '../MetricCard'
import { BoundParameterChip, useModalFieldBinding } from './bindingContext'
import { MetricSentenceBuilder } from './MetricSentenceBuilder'
import { ADD_CARD_PANES, type AddCardPane } from './panes'

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
	/** What Add still needs, shown under the sentence once Add was pressed. */
	error: string | null
	/** Below lg the form shows one pane; AddChartModal holds it, so a failed Add can bring back the pane with the error. */
	pane: AddCardPane
	onPaneChange: (pane: AddCardPane) => void
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
		onChartTypeChange,
		error,
		pane,
		onPaneChange
	} = props

	const { protocols: protocolList, chains: chainList } = useProDashboardCatalog()

	const { availableProtocolChartTypes, availableChainChartTypes } = useAppMetadata()
	const subjectParameter = useModalFieldBinding('subject', metricSubjectType)
	const nameId = useId()

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
			<SegmentedControl<AddCardPane>
				label="Editor view"
				options={ADD_CARD_PANES}
				value={pane}
				onValueChange={onPaneChange}
				variant="solid-responsive"
				size="md"
				className="shrink-0 lg:hidden"
			/>
			<div
				className={`w-full flex-col border border-subtle max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto lg:flex lg:w-[380px] lg:shrink lg:overflow-y-auto xl:w-[420px] ${pane === 'configure' ? 'flex' : 'hidden'}`}
			>
				<div className="flex flex-col gap-3 p-2.5 sm:p-3">
					<div className="rounded-lg border border-subtle bg-surface p-2.5 sm:p-3">
						<div className="flex items-start justify-between gap-2 sm:gap-3">
							<div>
								<label htmlFor={nameId} className="block label-sm text-primary">
									Card name (optional)
								</label>
								<p className="body-sm text-tertiary">Shown above the metric tile</p>
							</div>
							<div className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-link md:flex">
								<Icon name="pencil" width={14} height={14} />
							</div>
						</div>
						<div className="mt-2 space-y-1.5">
							<Input
								id={nameId}
								type="text"
								value={metricLabel}
								onChange={(e) => onLabelChange(e.target.value)}
								className="w-full"
								maxLength={64}
							/>
							<div className="flex items-center justify-between body-sm text-tertiary">
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
						error={error}
					/>
				</div>
			</div>

			<div
				className={`min-h-[280px] flex-1 shrink-0 flex-col overflow-hidden border border-subtle lg:flex lg:min-h-0 lg:shrink ${pane === 'preview' ? 'flex' : 'hidden'}`}
			>
				<div className="flex-1 overflow-hidden rounded-md bg-surface p-2 sm:p-2.5">
					{previewMetric ? (
						<MetricCard metric={previewMetric} />
					) : (
						<div className="flex h-full items-center justify-center body-sm text-tertiary sm:body-md">
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
