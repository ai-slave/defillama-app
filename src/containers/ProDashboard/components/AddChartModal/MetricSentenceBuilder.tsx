import {
	Combobox,
	ComboboxItem,
	ComboboxList,
	ComboboxProvider,
	Popover,
	useComboboxStore,
	usePopoverStore,
	useStoreState
} from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import type { Ref } from 'react'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useMedia } from '~/hooks/useMedia'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { useAppMetadata } from '../../AppMetadataContext'
import type { Chain, MetricAggregator, MetricChartType, MetricWindow, Protocol } from '../../types'
import { getProDashboardChartTypeConfig } from '../../types'
import { getItemIconUrl } from '../../utils'
import { useModalFieldBinding } from './bindingContext'
import { SUBJECT_OPTIONS } from './panes'

const CHART_TYPE_OPTIONS = [
	{
		value: 'sparkline',
		label: (
			<>
				<Icon name="activity" className="size-3.5" />
				<span>Line</span>
			</>
		)
	},
	{
		value: 'bar',
		label: (
			<>
				<Icon name="bar-chart-2" className="size-3.5" />
				<span>Bar</span>
			</>
		)
	},
	{
		value: 'none',
		label: (
			<>
				<Icon name="x" className="size-3.5" />
				<span>None</span>
			</>
		)
	}
] as const

const AGGREGATOR_OPTIONS: Array<{ value: MetricAggregator; label: string; description: string }> = [
	{ value: 'latest', label: 'Latest', description: 'Most recent value in the selected window' },
	{ value: 'avg', label: 'Average', description: 'Average of all values in the window' },
	{ value: 'max', label: 'Peak', description: 'Highest value in the window' },
	{ value: 'min', label: 'Low', description: 'Lowest value in the window' },
	{ value: 'sum', label: 'Total', description: 'Sum of all values in the window' },
	{ value: 'median', label: 'Median', description: 'Middle value, less affected by outliers' },
	{ value: 'stddev', label: 'Std deviation', description: 'Measure of volatility and variance' },
	{ value: 'first', label: 'First', description: 'First value at the beginning of the window' },
	{ value: 'growth', label: 'Growth rate', description: 'Percentage change from first to last value' },
	{ value: 'movingavg', label: 'Moving average', description: 'Smoothed trend analysis over the window' }
]

const WINDOW_OPTIONS: Array<{ value: MetricWindow; label: string; description: string }> = [
	{ value: '7d', label: '7 days', description: 'Last 7 days' },
	{ value: '30d', label: '30 days', description: 'Last 30 days' },
	{ value: '90d', label: '90 days', description: 'Last 90 days' },
	{ value: '365d', label: '365 days', description: 'Last 365 days' },
	{ value: 'ytd', label: 'Year to date', description: 'From January 1st to today' },
	{ value: '3y', label: '3 years', description: 'Last 3 years' },
	{ value: 'all', label: 'All time', description: 'Entire history' }
]

const AGGREGATOR_LABELS = Object.fromEntries(
	AGGREGATOR_OPTIONS.map((option) => [option.value, option.label])
) as Record<MetricAggregator, string>
const WINDOW_LABELS = Object.fromEntries(WINDOW_OPTIONS.map((option) => [option.value, option.label])) as Record<
	MetricWindow,
	string
>

type ActiveToken = 'aggregator' | 'metric' | 'subject' | 'window' | null

interface MetricSentenceBuilderProps {
	aggregator: MetricAggregator
	metricType: string
	metricSubjectType: 'chain' | 'protocol'
	metricChain: string | null
	metricProtocol: string | null
	metricWindow: MetricWindow
	chartType: MetricChartType
	availableMetricTypes: Array<string>
	chains: Array<Chain>
	protocols: Array<Protocol>
	onAggregatorChange: (value: MetricAggregator) => void
	onMetricTypeChange: (value: string) => void
	onSubjectTypeChange: (value: 'chain' | 'protocol') => void
	onChainChange: (option: { value: string; label: string }) => void
	onProtocolChange: (option: { value: string; label: string }) => void
	onWindowChange: (value: MetricWindow) => void
	onChartTypeChange: (value: MetricChartType) => void
}

const getTokenWidth = (token: Exclude<ActiveToken, null>, isMobile: boolean): number => {
	if (isMobile) {
		// Use window.innerWidth for dynamic sizing when popover opens (one-time read, not subscribed)
		const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 320
		return Math.min(viewportWidth - 32, token === 'subject' ? 340 : 280)
	}
	switch (token) {
		case 'aggregator':
			return 260
		case 'metric':
			return 320
		case 'subject':
			return 360
		case 'window':
			return 260
	}
}

interface TokenButtonProps {
	label: string
	secondary?: string
	onClick: () => void
	active?: boolean
}

function TokenButton({ label, secondary, onClick, active, ref }: TokenButtonProps & { ref?: Ref<HTMLButtonElement> }) {
	return (
		<Button
			variant="filter"
			size="sm"
			onClick={onClick}
			data-metric-token="true"
			data-active={active}
			aria-expanded={active}
			ref={ref}
		>
			<span className="max-w-[100px] truncate sm:max-w-[180px]">{label}</span>
			<Icon name="chevron-down" className="size-3.5 shrink-0 text-tertiary" />
			{secondary ? <span className="sr-only">{secondary}</span> : null}
		</Button>
	)
}

export function MetricSentenceBuilder({
	aggregator,
	metricType,
	metricSubjectType,
	metricChain,
	metricProtocol,
	metricWindow,
	chartType,
	availableMetricTypes,
	chains,
	protocols,
	onAggregatorChange,
	onMetricTypeChange,
	onSubjectTypeChange,
	onChainChange,
	onProtocolChange,
	onWindowChange,
	onChartTypeChange
}: MetricSentenceBuilderProps) {
	const [activeToken, setActiveToken] = useState<ActiveToken>(null)
	const [searchTerm, setSearchTerm] = useState('')
	const [subjectTab, setSubjectTab] = useState<'chain' | 'protocol'>('chain')
	const subjectParameter = useModalFieldBinding('subject', subjectTab)
	const isMobile = useMedia('(max-width: 639px)')
	const popover = usePopoverStore({
		placement: isMobile ? 'bottom' : 'right-start',
		// Every close runs the same teardown, including the ones that never reach closePopover: an
		// outside click or Escape. Nothing is left over for the next open to reset.
		setOpen(open) {
			if (open) return
			setActiveToken(null)
			setSearchTerm('')
			setSubjectTab(metricSubjectType)
			subjectCombobox.setInputValue('')
			subjectCombobox.setOpen(false)
		}
	})
	const subjectCombobox = useComboboxStore({ resetValueOnHide: true })
	const anchorRefs = useRef<Record<Exclude<ActiveToken, null>, HTMLButtonElement | null>>({
		aggregator: null,
		metric: null,
		subject: null,
		window: null
	})
	const [popoverWidth, setPopoverWidth] = useState(260)
	const subjectSearchValue = useStoreState(subjectCombobox, 'inputValue') ?? ''
	const deferredSubjectSearchValue = useDeferredValue(subjectSearchValue)
	const chainListRef = useRef<HTMLDivElement | null>(null)
	const protocolListRef = useRef<HTMLDivElement | null>(null)
	const { availableProtocolChartTypes, availableChainChartTypes } = useAppMetadata()

	const closePopover = () => {
		popover.setOpen(false)
	}

	const chainOptions = useMemo(
		() =>
			[...chains]
				.sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
				.map((chain) => ({ value: chain.name, label: chain.name })),
		[chains]
	)

	const protocolOptions = useMemo(() => {
		const childrenByParentId = new Map<string, Array<Protocol>>()
		const parentsOrSolo: Array<Protocol> = []

		for (const protocol of protocols) {
			if (protocol.parentProtocol) {
				const arr = childrenByParentId.get(protocol.parentProtocol) || []
				arr.push(protocol)
				childrenByParentId.set(protocol.parentProtocol, arr)
			} else {
				parentsOrSolo.push(protocol)
			}
		}

		parentsOrSolo.sort((a, b) => (b.tvl || 0) - (a.tvl || 0))

		const options: Array<{ value: string; label: string; logo?: string; isChild?: boolean }> = []
		const includedSlugs = new Set<string>()

		for (const parent of parentsOrSolo) {
			if (!parent.slug) continue
			const childProtocols = (childrenByParentId.get(parent.id) || []).sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
			options.push({
				value: parent.slug,
				label: parent.name,
				...(parent.logo === undefined ? {} : { logo: parent.logo })
			})
			includedSlugs.add(parent.slug)
			for (const child of childProtocols) {
				if (!child.slug) continue
				options.push({
					value: child.slug,
					label: child.name,
					...(child.logo === undefined ? {} : { logo: child.logo }),
					isChild: true
				})
				includedSlugs.add(child.slug)
			}
		}

		for (const protocol of protocols) {
			if (!protocol.slug || !protocol.parentProtocol) continue
			if (includedSlugs.has(protocol.slug)) continue
			options.push({
				value: protocol.slug,
				label: protocol.name,
				...(protocol.logo === undefined ? {} : { logo: protocol.logo }),
				isChild: true
			})
			includedSlugs.add(protocol.slug)
		}

		return options
	}, [protocols])

	const globalAvailableMetricTypes = useMemo(() => {
		const set = new Set<string>()
		for (const chain of chains) {
			const geckoId = chain.gecko_id
			for (const t of availableChainChartTypes(chain.name, { hasGeckoId: !!geckoId })) set.add(t)
		}
		for (const protocol of protocols) {
			if (!protocol.slug) continue
			const geckoId = protocol.geckoId
			for (const t of availableProtocolChartTypes(protocol.slug, { hasGeckoId: !!geckoId })) set.add(t)
		}
		return Array.from(set)
	}, [chains, protocols, availableChainChartTypes, availableProtocolChartTypes])

	const baseMetricTypes = availableMetricTypes.length > 0 ? availableMetricTypes : globalAvailableMetricTypes

	const allowedChainNamesForMetric = useMemo(() => {
		if (!metricType) return null as Set<string> | null
		const s = new Set<string>()
		for (const chain of chains) {
			const geckoId = chain.gecko_id
			const types = availableChainChartTypes(chain.name, { hasGeckoId: !!geckoId })
			if (types.some((type) => type === metricType)) s.add(chain.name)
		}
		return s
	}, [metricType, chains, availableChainChartTypes])

	const chainOptionsByMetric = useMemo(() => {
		if (!allowedChainNamesForMetric) return chainOptions
		return chainOptions.filter((o) => allowedChainNamesForMetric.has(o.value))
	}, [chainOptions, allowedChainNamesForMetric])

	const filteredChainOptions = useMemo(() => {
		if (!deferredSubjectSearchValue) return chainOptionsByMetric
		return matchSorter(chainOptionsByMetric, deferredSubjectSearchValue, { keys: ['label'] })
	}, [chainOptionsByMetric, deferredSubjectSearchValue])

	const allowedProtocolSlugsForMetric = useMemo(() => {
		if (!metricType) return null as Set<string> | null
		const s = new Set<string>()
		for (const protocol of protocols) {
			if (!protocol.slug) continue
			const geckoId = protocol.geckoId
			const types = availableProtocolChartTypes(protocol.slug, { hasGeckoId: !!geckoId })
			if (types.some((type) => type === metricType)) s.add(protocol.slug)
		}
		return s
	}, [metricType, protocols, availableProtocolChartTypes])

	const protocolOptionsByMetric = useMemo(() => {
		if (!allowedProtocolSlugsForMetric) return protocolOptions
		return protocolOptions.filter((o) => allowedProtocolSlugsForMetric.has(o.value))
	}, [protocolOptions, allowedProtocolSlugsForMetric])

	const filteredProtocolOptions = useMemo(() => {
		if (!deferredSubjectSearchValue) return protocolOptionsByMetric
		return matchSorter(protocolOptionsByMetric, deferredSubjectSearchValue, { keys: ['label'] })
	}, [protocolOptionsByMetric, deferredSubjectSearchValue])

	const chainVirtualizer = useVirtualItems({
		count: subjectTab === 'chain' ? filteredChainOptions.length : 0,
		getScrollElement: () => chainListRef.current,
		estimateSize: () => 38,
		overscan: 8
	})

	const protocolVirtualizer = useVirtualItems({
		count: subjectTab === 'protocol' ? filteredProtocolOptions.length : 0,
		getScrollElement: () => protocolListRef.current,
		estimateSize: () => 42,
		overscan: 8
	})

	const aggregatorLabel = AGGREGATOR_LABELS[aggregator] ?? 'Latest'
	const metricLabel = metricType ? getProDashboardChartTypeConfig(metricType)?.title || metricType : 'metric'
	const windowLabel = WINDOW_LABELS[metricWindow] ?? 'window'

	const subjectLabel = useMemo(() => {
		if (metricSubjectType === 'chain') {
			if (!metricChain) return 'a chain'
			return metricChain
		}
		if (!metricProtocol) return 'a protocol'
		const option = protocolOptions.find((opt) => opt.value === metricProtocol)
		if (!option) return metricProtocol
		return option.label
	}, [metricSubjectType, metricChain, metricProtocol, protocolOptions])

	const filteredMetrics = useMemo(() => {
		if (!searchTerm) return baseMetricTypes
		const term = searchTerm.toLowerCase()
		return baseMetricTypes.filter((value) => {
			const label = getProDashboardChartTypeConfig(value)?.title || value
			return label.toLowerCase().includes(term) || value.toLowerCase().includes(term)
		})
	}, [baseMetricTypes, searchTerm])

	const handleTokenClick = (token: Exclude<ActiveToken, null>) => {
		if (activeToken === token) {
			closePopover()
			return
		}

		const anchor = anchorRefs.current[token]
		if (!anchor) return

		// The subject list is a combobox that shows its items only while open. Switching to another token
		// keeps the popover open, so the popover's own teardown does not clear the subject search.
		if (token === 'subject') {
			setSubjectTab(metricSubjectType)
			subjectCombobox.setOpen(true)
		} else {
			subjectCombobox.setInputValue('')
			subjectCombobox.setOpen(false)
		}

		// Switching tokens without closing keeps the popover open, so the previous token's search has to
		// be cleared here too.
		setSearchTerm('')
		setPopoverWidth(getTokenWidth(token, isMobile))
		setActiveToken(token)
		popover.setAnchorElement(anchor)
		popover.setOpen(true)
	}

	const handleChainSelect = (option: { value: string; label: string }) => {
		onSubjectTypeChange('chain')
		onChainChange(option)
	}

	const handleSubjectParameterSelect = (variableId: string, value: string) => {
		if (subjectTab === 'chain') handleChainSelect({ value, label: value })
		else handleProtocolSelect({ value, label: value })
		subjectParameter.bind(variableId)
		closePopover()
	}

	const handleProtocolSelect = (option: { value: string; label: string }) => {
		onSubjectTypeChange('protocol')
		onProtocolChange(option)
	}

	const handleSelectMetric = (value: string) => {
		onMetricTypeChange(value)
		closePopover()
	}

	const handleSelectAggregator = (value: MetricAggregator) => {
		onAggregatorChange(value)
		closePopover()
	}

	const handleSelectWindow = (value: MetricWindow) => {
		onWindowChange(value)
		closePopover()
	}

	const popoverContent = (() => {
		switch (activeToken) {
			case 'aggregator':
				return (
					<div className="max-h-[280px] overflow-y-auto overscroll-contain p-1.5" data-metric-token="true">
						{AGGREGATOR_OPTIONS.map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() => handleSelectAggregator(option.value)}
								className={`w-full rounded-md px-2.5 py-1.5 text-left label-md transition-colors ${
									option.value === aggregator ? 'text-pro-text-primary' : 'text-pro-text-secondary'
								}`}
							>
								<div>{option.label}</div>
								<div className="body-sm text-pro-text-tertiary">{option.description}</div>
							</button>
						))}
					</div>
				)
			case 'window':
				return (
					<div className="max-h-[280px] overflow-y-auto overscroll-contain p-1.5" data-metric-token="true">
						{WINDOW_OPTIONS.map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() => handleSelectWindow(option.value)}
								className={`w-full rounded-md px-2.5 py-1.5 text-left label-md transition-colors ${
									option.value === metricWindow ? 'text-pro-text-primary' : 'text-pro-text-secondary'
								}`}
							>
								<div>{option.label}</div>
								<div className="body-sm text-pro-text-tertiary">{option.description}</div>
							</button>
						))}
					</div>
				)
			case 'metric':
				return (
					<div className="max-h-[320px] w-full overflow-y-auto overscroll-contain" data-metric-token="true">
						<div className="sticky top-0 border-b border-pro-cards-border bg-pro-cards-bg p-1.5">
							<input
								value={searchTerm}
								onChange={(event) => setSearchTerm(event.target.value)}
								aria-label="Search metrics"
								placeholder="Search metrics…"
								className="w-full rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2 py-1.5 body-md focus:ring-1 focus:ring-brand focus:outline-hidden"
							/>
						</div>
						<div className="p-1.5">
							{baseMetricTypes.length === 0 ? (
								<p className="px-2 py-3 body-md text-pro-text-tertiary">No metrics available.</p>
							) : null}
							{baseMetricTypes.length > 0 && filteredMetrics.length === 0 ? (
								<p className="px-2 py-3 body-md text-pro-text-tertiary">No metrics match that search.</p>
							) : null}
							{filteredMetrics.map((value) => {
								const label = getProDashboardChartTypeConfig(value)?.title || value
								const isActive = value === metricType
								return (
									<button
										key={value}
										type="button"
										onClick={() => handleSelectMetric(value)}
										className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 label-md transition-colors ${
											isActive ? 'text-pro-text-primary' : 'text-pro-text-secondary'
										}`}
									>
										<span>{label}</span>
										{isActive ? <Icon name="check" width={14} height={14} /> : null}
									</button>
								)
							})}
						</div>
					</div>
				)
			case 'subject':
				return (
					<ComboboxProvider store={subjectCombobox}>
						<div className="w-full space-y-2.5 p-2.5 sm:space-y-3 sm:p-3" data-metric-token="true">
							<div className="space-y-1.5">
								<div className="label-sm text-pro-text-secondary">Select subject</div>
								<SegmentedControl
									variant="field"
									size="md"
									label="Subject type"
									options={SUBJECT_OPTIONS}
									value={subjectTab}
									onValueChange={(value) => {
										setSubjectTab(value)
										subjectCombobox.setInputValue('')
									}}
								/>
							</div>

							<div className="space-y-2">
								{subjectParameter.options.length > 0 ? (
									<div className="flex flex-col gap-1">
										{subjectParameter.options.map((option) => {
											const variable = subjectParameter.resolveSelection(option.value)
											if (!variable) return null
											return (
												<button
													key={option.value}
													type="button"
													onClick={() => handleSubjectParameterSelect(variable.id, variable.value)}
													data-umami-event="dashboard-parameter-bind-metric-subject"
													className={`flex items-center justify-between gap-2 rounded-md border border-pro-cards-border px-2.5 py-1.5 text-left label-md transition-colors ${
														subjectParameter.boundVariable?.id === variable.id
															? 'bg-brand/10 text-pro-text-primary'
															: 'text-pro-text-secondary hover:bg-pro-cards-bg'
													}`}
												>
													<span className="truncate">{variable.label}</span>
													<span className="shrink-0 body-sm text-pro-text-tertiary">{option.description}</span>
												</button>
											)
										})}
									</div>
								) : null}
								<div className="rounded-lg border border-dashed border-pro-cards-border bg-pro-cards-bg p-2.5 shadow-inner">
									<Combobox
										autoFocus
										placeholder={subjectTab === 'chain' ? 'Search chains…' : 'Search protocols…'}
										className="mb-1.5 w-full rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2.5 py-1.5 body-md focus:ring-1 focus:ring-brand focus:outline-hidden"
										aria-label="Search"
									/>
									{subjectTab === 'chain' ? (
										filteredChainOptions.length > 0 ? (
											<ComboboxList ref={chainListRef} className="max-h-[240px] overflow-y-auto overscroll-contain">
												<div style={{ height: chainVirtualizer.totalSize, position: 'relative' }}>
													{chainVirtualizer.items.map((virtualRow) => {
														const option = filteredChainOptions[virtualRow.index]
														if (!option) return null
														const isActive = metricChain === option.value
														const iconUrl = option.value === 'All' ? null : getItemIconUrl('chain', null, option.value)
														return (
															<ComboboxItem
																key={option.value}
																value={option.value}
																setValueOnClick={false}
																onClick={() => {
																	handleChainSelect(option)
																	closePopover()
																}}
																className={`flex items-center justify-between rounded-md px-2.5 py-1.5 label-md transition-colors ${
																	isActive ? 'bg-brand/10 text-pro-text-primary' : 'text-pro-text-secondary'
																}`}
																style={{
																	position: 'absolute',
																	top: 0,
																	left: 0,
																	width: '100%',
																	transform: `translateY(${virtualRow.start}px)`
																}}
															>
																<div className="flex min-w-0 items-center gap-2">
																	{iconUrl ? (
																		<img
																			src={iconUrl}
																			alt={option.label}
																			width={20}
																			height={20}
																			className="size-5 rounded-full object-cover"
																		/>
																	) : null}
																	<span className="truncate">{option.label}</span>
																</div>
																{isActive ? <Icon name="check" width={14} height={14} /> : null}
															</ComboboxItem>
														)
													})}
												</div>
											</ComboboxList>
										) : (
											<p className="px-2 py-6 text-center body-md text-pro-text-tertiary">No chains found.</p>
										)
									) : filteredProtocolOptions.length > 0 ? (
										<ComboboxList ref={protocolListRef} className="max-h-[240px] overflow-y-auto overscroll-contain">
											<div style={{ height: protocolVirtualizer.totalSize, position: 'relative' }}>
												{protocolVirtualizer.items.map((virtualRow) => {
													const option = filteredProtocolOptions[virtualRow.index]
													if (!option) return null
													const isActive = metricProtocol === option.value
													const iconUrl = getItemIconUrl('protocol', option, option.value)
													return (
														<ComboboxItem
															key={option.value}
															value={option.value}
															setValueOnClick={false}
															onClick={() => {
																handleProtocolSelect(option)
																closePopover()
															}}
															className={`flex items-center justify-between rounded-md px-2.5 py-1.5 label-md transition-colors ${
																isActive ? 'bg-brand/10 text-pro-text-primary' : 'text-pro-text-secondary'
															}`}
															style={{
																position: 'absolute',
																top: 0,
																left: 0,
																width: '100%',
																transform: `translateY(${virtualRow.start}px)`
															}}
														>
															<div className={`flex min-w-0 items-center gap-2 ${option.isChild ? 'pl-4' : ''}`}>
																{iconUrl ? (
																	<img
																		src={option.logo || iconUrl}
																		alt={option.label}
																		width={20}
																		height={20}
																		className={`size-5 rounded-full object-cover ${option.isChild ? 'opacity-80' : ''}`}
																	/>
																) : null}
																<div className="flex min-w-0 flex-col">
																	<span
																		className={`truncate ${option.isChild ? 'text-pro-text-secondary' : 'text-pro-text-primary'}`}
																	>
																		{option.label}
																	</span>
																	{option.isChild ? (
																		<span className="body-sm text-pro-text-tertiary">Child protocol</span>
																	) : null}
																</div>
															</div>
															{isActive ? <Icon name="check" width={14} height={14} /> : null}
														</ComboboxItem>
													)
												})}
											</div>
										</ComboboxList>
									) : (
										<p className="px-2 py-6 text-center body-md text-pro-text-tertiary">No protocols found.</p>
									)}
								</div>
							</div>
						</div>
					</ComboboxProvider>
				)
			default:
				return null
		}
	})()

	const handleTokenPress = (token: Exclude<ActiveToken, null>) => () => {
		handleTokenClick(token)
	}

	return (
		<div className="flex flex-col gap-2.5 sm:gap-3">
			<div className="rounded-lg border border-pro-cards-border bg-linear-to-br from-pro-cards-bg via-pro-cards-bg to-pro-cards-bg p-2.5 shadow-sm sm:p-3">
				<div className="mb-4 flex items-center gap-2 sm:gap-2.5">
					<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/12 text-brand sm:size-8">
						<Icon name="sparkles" width={14} height={14} className="sm:size-4" />
					</div>
					<div className="min-w-0">
						<div className="title-sm text-pro-text-primary">Metric sentence builder</div>
						<div className="body-sm text-pro-text-tertiary">Create metrics based on natural language</div>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-pro-text-primary sm:gap-x-2.5 sm:gap-y-2">
					<span className="body-sm text-pro-text-tertiary sm:body-md">Show</span>
					<TokenButton
						label={aggregatorLabel}
						onClick={handleTokenPress('aggregator')}
						active={activeToken === 'aggregator'}
						ref={(node) => {
							anchorRefs.current.aggregator = node
						}}
					/>
					<TokenButton
						label={metricLabel || 'metric'}
						onClick={handleTokenPress('metric')}
						active={activeToken === 'metric'}
						ref={(node) => {
							anchorRefs.current.metric = node
						}}
					/>
					<span className="body-sm text-pro-text-tertiary sm:body-md">for</span>
					<TokenButton
						label={subjectLabel}
						onClick={handleTokenPress('subject')}
						active={activeToken === 'subject'}
						ref={(node) => {
							anchorRefs.current.subject = node
						}}
					/>
					<span className="body-sm text-pro-text-tertiary sm:body-md">over</span>
					<TokenButton
						label={windowLabel}
						onClick={handleTokenPress('window')}
						active={activeToken === 'window'}
						ref={(node) => {
							anchorRefs.current.window = node
						}}
					/>
				</div>
				<div className="mt-2.5 flex items-center gap-2 rounded-md border border-dashed border-pro-cards-border px-2 py-1.5 sm:mt-3 sm:px-2.5">
					<span className="label-sm text-pro-text-secondary">Chart</span>
					<SegmentedControl
						label="Chart type"
						value={chartType}
						onValueChange={onChartTypeChange}
						options={CHART_TYPE_OPTIONS}
						variant="field"
						size="sm"
					/>
				</div>
			</div>
			<Popover
				store={popover}
				modal={false}
				data-metric-token="true"
				className="z-50 rounded-lg border border-pro-cards-border bg-pro-cards-bg shadow-lg"
				style={{
					width: popoverWidth,
					maxWidth: 'calc(100vw - 16px)',
					maxHeight: 'calc(100vh - 32px)',
					overflow: 'hidden auto'
				}}
			>
				{popoverContent}
			</Popover>
		</div>
	)
}
