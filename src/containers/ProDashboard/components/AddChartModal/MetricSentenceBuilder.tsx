import {
	Combobox,
	ComboboxItem,
	ComboboxList,
	ComboboxProvider,
	useComboboxStore,
	usePopoverStore,
	useStoreState
} from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import type { Ref } from 'react'
import { useDeferredValue, useId, useMemo, useRef, useState } from 'react'
import { SelectCheckIcon } from '~/components/Select/SelectCheckIcon'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { NoResults } from '~/ui/NoResults'
import {
	popoverMeasuredRowStyles,
	popoverRowStyles,
	popoverScrollAreaStyles,
	popoverSingleSelectCheckStyles
} from '~/ui/Popover'
import { PopoverHeader } from '~/ui/PopoverHeader'
import { PopoverSurface } from '~/ui/PopoverSurface'
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

type MetricToken = 'aggregator' | 'metric' | 'subject' | 'window'

// From `sm` the popover sits beside its token at these widths; on phones it is a full-width drawer.
const TOKEN_POPOVERS: Record<MetricToken, { heading: string; width: string }> = {
	aggregator: { heading: 'Aggregation', width: 'w-[260px]' },
	metric: { heading: 'Metric', width: 'w-80' },
	subject: { heading: 'Subject', width: 'w-[360px]' },
	window: { heading: 'Time window', width: 'w-[260px]' }
}

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
	/** What Add still needs (a metric or a subject), shown under the sentence once Add was pressed. */
	error: string | null
}

interface TokenButtonProps {
	label: string
	secondary?: string
	onClick: () => void
	active?: boolean
	/** The id of the error this token needs fixed, when it has one. */
	errorId?: string
}

function TokenButton({
	label,
	secondary,
	onClick,
	active,
	errorId,
	ref
}: TokenButtonProps & { ref?: Ref<HTMLButtonElement> }) {
	return (
		<Button
			variant="filter"
			size="sm"
			onClick={onClick}
			data-metric-token="true"
			data-active={active}
			aria-expanded={active}
			aria-invalid={errorId ? true : undefined}
			aria-describedby={errorId}
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
	onChartTypeChange,
	error
}: MetricSentenceBuilderProps) {
	const errorId = `${useId()}-error`
	// A missing metric is the metric token's error; otherwise the subject is what is missing.
	const metricErrorId = error && !metricType ? errorId : undefined
	const subjectErrorId = error && metricType ? errorId : undefined
	// The token the popover was last opened from. It stays set through the close, so the closing popover keeps
	// its content; whether it is open is the popover's own state.
	const [activeToken, setActiveToken] = useState<MetricToken | null>(null)
	const [searchTerm, setSearchTerm] = useState('')
	const [subjectTab, setSubjectTab] = useState<'chain' | 'protocol'>('chain')
	const subjectParameter = useModalFieldBinding('subject', subjectTab)
	const popover = usePopoverStore({
		placement: 'right-start',
		// Every close runs the same teardown, including the ones that never reach closePopover: an
		// outside click or Escape. Nothing is left over for the next open to reset.
		setOpen(open) {
			if (open) return
			setSearchTerm('')
			setSubjectTab(metricSubjectType)
			subjectCombobox.setInputValue('')
			subjectCombobox.setOpen(false)
		}
	})
	const subjectCombobox = useComboboxStore({ resetValueOnHide: true })
	const popoverOpen = useStoreState(popover, 'open')
	const openToken = popoverOpen ? activeToken : null
	const anchorRefs = useRef<Record<MetricToken, HTMLButtonElement | null>>({
		aggregator: null,
		metric: null,
		subject: null,
		window: null
	})
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

	// Rows are measured: a phone row is 44px tall, and a child protocol's row holds two lines.
	const chainVirtualizer = useVirtualItems({
		count: subjectTab === 'chain' ? filteredChainOptions.length : 0,
		getScrollElement: () => chainListRef.current,
		estimateSize: () => 37,
		overscan: 8
	})

	const protocolVirtualizer = useVirtualItems({
		count: subjectTab === 'protocol' ? filteredProtocolOptions.length : 0,
		getScrollElement: () => protocolListRef.current,
		estimateSize: (index) => (filteredProtocolOptions[index]!.isChild ? 56 : 37),
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

	const handleTokenClick = (token: MetricToken) => {
		if (openToken === token) {
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
					<DescribedOptionRows options={AGGREGATOR_OPTIONS} selected={aggregator} onSelect={handleSelectAggregator} />
				)
			case 'window':
				return <DescribedOptionRows options={WINDOW_OPTIONS} selected={metricWindow} onSelect={handleSelectWindow} />
			case 'metric':
				return (
					<>
						<PopoverHeader
							search={
								<div className="relative">
									<Icon name="search" className={searchFieldIconStyles} />
									<Input
										value={searchTerm}
										onChange={(event) => setSearchTerm(event.target.value)}
										aria-label="Search metrics"
										placeholder="Search metrics…"
										className={searchFieldInputPlacementStyles}
									/>
								</div>
							}
						/>
						<div className={popoverScrollAreaStyles}>
							{baseMetricTypes.length === 0 ? <NoResults>No metrics available.</NoResults> : null}
							{baseMetricTypes.length > 0 && filteredMetrics.length === 0 ? (
								<NoResults>No metrics match that search.</NoResults>
							) : null}
							{filteredMetrics.map((value) => (
								<button
									key={value}
									type="button"
									className={`${popoverRowStyles} w-full text-left`}
									onClick={() => handleSelectMetric(value)}
								>
									<span className="truncate">{getProDashboardChartTypeConfig(value)?.title || value}</span>
									<span aria-hidden className={popoverSingleSelectCheckStyles(value === metricType)}>
										<SelectCheckIcon />
									</span>
								</button>
							))}
						</div>
					</>
				)
			case 'subject':
				return (
					<ComboboxProvider store={subjectCombobox}>
						<PopoverHeader
							search={
								<div className="relative">
									<Icon name="search" className={searchFieldIconStyles} />
									<Combobox
										autoFocus
										placeholder={subjectTab === 'chain' ? 'Search chains…' : 'Search protocols…'}
										render={<Input className={searchFieldInputPlacementStyles} />}
										aria-label={subjectTab === 'chain' ? 'Search chains' : 'Search protocols'}
									/>
								</div>
							}
						>
							<div className="px-3 pb-2">
								<SegmentedControl
									variant="default"
									size="sm"
									label="Subject type"
									options={SUBJECT_OPTIONS}
									value={subjectTab}
									onValueChange={(value) => {
										setSubjectTab(value)
										subjectCombobox.setInputValue('')
									}}
								/>
							</div>
						</PopoverHeader>
						{subjectParameter.options.length > 0 ? (
							<div className="flex shrink-0 flex-col border-b border-subtle">
								{subjectParameter.options.map((option) => {
									const variable = subjectParameter.resolveSelection(option.value)
									if (!variable) return null
									const bound = subjectParameter.boundVariable?.id === variable.id
									return (
										<button
											key={option.value}
											type="button"
											aria-pressed={bound}
											onClick={() => handleSubjectParameterSelect(variable.id, variable.value)}
											data-umami-event="dashboard-parameter-bind-metric-subject"
											className={`${popoverRowStyles} w-full text-left`}
										>
											<span className="min-w-0 flex-1 truncate">{variable.label}</span>
											<span className="shrink-0 body-sm text-tertiary">{option.description}</span>
											<span aria-hidden className={popoverSingleSelectCheckStyles(bound)}>
												<SelectCheckIcon />
											</span>
										</button>
									)
								})}
							</div>
						) : null}
						{subjectTab === 'chain' ? (
							filteredChainOptions.length > 0 ? (
								<ComboboxList ref={chainListRef} className={popoverScrollAreaStyles}>
									<div className="relative w-full" style={{ height: chainVirtualizer.totalSize }}>
										{chainVirtualizer.items.map((virtualRow) => {
											const option = filteredChainOptions[virtualRow.index]!
											const iconUrl = option.value === 'All' ? null : getItemIconUrl('chain', null, option.value)
											return (
												<div
													key={option.value}
													ref={chainVirtualizer.measureElement}
													data-index={virtualRow.index}
													className="absolute inset-x-0 top-0"
													style={{ transform: `translateY(${virtualRow.start}px)` }}
												>
													<ComboboxItem
														value={option.value}
														setValueOnClick={false}
														onClick={() => {
															handleChainSelect(option)
															closePopover()
														}}
														className={popoverMeasuredRowStyles}
													>
														<span className="flex min-w-0 items-center gap-2">
															{iconUrl ? (
																<img
																	src={iconUrl}
																	alt=""
																	width={20}
																	height={20}
																	className="size-5 shrink-0 rounded-full object-cover"
																/>
															) : null}
															<span className="truncate">{option.label}</span>
														</span>
														<span aria-hidden className={popoverSingleSelectCheckStyles(metricChain === option.value)}>
															<SelectCheckIcon />
														</span>
													</ComboboxItem>
												</div>
											)
										})}
									</div>
								</ComboboxList>
							) : (
								<NoResults>No chains found.</NoResults>
							)
						) : filteredProtocolOptions.length > 0 ? (
							<ComboboxList ref={protocolListRef} className={popoverScrollAreaStyles}>
								<div className="relative w-full" style={{ height: protocolVirtualizer.totalSize }}>
									{protocolVirtualizer.items.map((virtualRow) => {
										const option = filteredProtocolOptions[virtualRow.index]!
										const iconUrl = getItemIconUrl('protocol', option, option.value)
										return (
											<div
												key={option.value}
												ref={protocolVirtualizer.measureElement}
												data-index={virtualRow.index}
												className="absolute inset-x-0 top-0"
												style={{ transform: `translateY(${virtualRow.start}px)` }}
											>
												<ComboboxItem
													value={option.value}
													setValueOnClick={false}
													onClick={() => {
														handleProtocolSelect(option)
														closePopover()
													}}
													className={popoverMeasuredRowStyles}
												>
													<span className={`flex min-w-0 items-center gap-2 ${option.isChild ? 'pl-4' : ''}`}>
														{iconUrl ? (
															<img
																src={option.logo || iconUrl}
																alt=""
																width={20}
																height={20}
																className={`size-5 shrink-0 rounded-full object-cover ${option.isChild ? 'opacity-80' : ''}`}
															/>
														) : null}
														<span className="flex min-w-0 flex-col">
															<span className={`truncate ${option.isChild ? 'text-secondary' : 'text-primary'}`}>
																{option.label}
															</span>
															{option.isChild ? <span className="body-sm text-tertiary">Child protocol</span> : null}
														</span>
													</span>
													<span aria-hidden className={popoverSingleSelectCheckStyles(metricProtocol === option.value)}>
														<SelectCheckIcon />
													</span>
												</ComboboxItem>
											</div>
										)
									})}
								</div>
							</ComboboxList>
						) : (
							<NoResults>No protocols found.</NoResults>
						)}
					</ComboboxProvider>
				)
			case null:
				return null
		}
	})()

	const handleTokenPress = (token: MetricToken) => () => {
		handleTokenClick(token)
	}

	return (
		<div data-invalid={error ? '' : undefined} className="flex flex-col gap-2.5 sm:gap-3">
			<div className="rounded-lg border border-subtle bg-linear-to-br from-surface via-surface to-surface p-2.5 sm:p-3">
				<div className="mb-4 flex items-center gap-2 sm:gap-2.5">
					<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-tint text-link sm:size-8">
						<Icon name="sparkles" className="size-3.5 sm:size-4" />
					</div>
					<div className="min-w-0">
						<div className="title-sm text-primary">Metric sentence builder</div>
						<div className="body-sm text-tertiary">Create metrics based on natural language</div>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-primary sm:gap-x-2.5 sm:gap-y-2">
					<span className="body-sm text-tertiary sm:body-md">Show</span>
					<TokenButton
						label={aggregatorLabel}
						onClick={handleTokenPress('aggregator')}
						active={openToken === 'aggregator'}
						ref={(node) => {
							anchorRefs.current.aggregator = node
						}}
					/>
					<TokenButton
						label={metricLabel || 'metric'}
						onClick={handleTokenPress('metric')}
						active={openToken === 'metric'}
						errorId={metricErrorId}
						ref={(node) => {
							anchorRefs.current.metric = node
						}}
					/>
					<span className="body-sm text-tertiary sm:body-md">for</span>
					<TokenButton
						label={subjectLabel}
						onClick={handleTokenPress('subject')}
						active={openToken === 'subject'}
						errorId={subjectErrorId}
						ref={(node) => {
							anchorRefs.current.subject = node
						}}
					/>
					<span className="body-sm text-tertiary sm:body-md">over</span>
					<TokenButton
						label={windowLabel}
						onClick={handleTokenPress('window')}
						active={openToken === 'window'}
						ref={(node) => {
							anchorRefs.current.window = node
						}}
					/>
				</div>
				<div className="mt-2.5 flex items-center gap-2 rounded-md border border-dashed border-medium px-2 py-1.5 sm:mt-3 sm:px-2.5">
					<span className="label-sm text-secondary">Chart</span>
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
			{error ? (
				<p id={errorId} className="body-sm text-error">
					{error}
				</p>
			) : null}
			{activeToken ? (
				<PopoverSurface
					store={popover}
					modal={false}
					variant="list"
					heading={TOKEN_POPOVERS[activeToken].heading}
					className={TOKEN_POPOVERS[activeToken].width}
				>
					{popoverContent}
				</PopoverSurface>
			) : null}
		</div>
	)
}

/** A pick list whose rows carry a label and a one-line description; the picked row shows the check. The rows skip
    `content-visibility` (popoverMeasuredRowStyles): its placeholder is a one-line row's height. */
function DescribedOptionRows<T extends string>({
	options,
	selected,
	onSelect
}: {
	options: Array<{ value: T; label: string; description: string }>
	selected: T
	onSelect: (value: T) => void
}) {
	return (
		<>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					className={`${popoverMeasuredRowStyles} w-full text-left`}
					onClick={() => onSelect(option.value)}
				>
					<span className="flex min-w-0 flex-col">
						<span className="label-md">{option.label}</span>
						<span className="body-sm text-tertiary">{option.description}</span>
					</span>
					<span aria-hidden className={popoverSingleSelectCheckStyles(option.value === selected)}>
						<SelectCheckIcon />
					</span>
				</button>
			))}
		</>
	)
}
