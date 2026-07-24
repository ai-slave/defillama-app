import {
	type ColumnFiltersState,
	type ColumnOrderState,
	createColumnHelper,
	type ExpandedState,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import clsx from 'clsx'
import { matchSorter } from 'match-sorter'
import { startTransition, useDeferredValue, useMemo, useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { VirtualTable } from '~/components/Table/Table'
import { prepareTableCsv } from '~/components/Table/utils'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { TableToolbarControlGroup } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import type { IRWAAssetFlowSummary, IRWAAssetsOverview, IRWAFlowSummaryResponse, RWAFlowWindow } from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import { BreakdownTooltipContent } from './BreakdownTooltipContent'
import { definitions } from './definitions'
import { RWAFlowSummaryTooltip, RWAFlowValueShimmer, RWAFlowValueUnavailable } from './FlowPanelParts'
import { formatSignedRWAFlow, getRWAFlowTextClass } from './flows'
import { useRWAFlowSummary } from './flows.hooks'
import { getRwaPlatforms, UNKNOWN_PLATFORM } from './grouping'
import { rwaSlug } from './rwaSlug'

export function RWAAssetsTable({
	assets,
	selectedChain,
	includeRwaPerps
}: {
	assets: IRWAAssetsOverview['assets']
	selectedChain: string
	includeRwaPerps: boolean
}) {
	const { data: flowSummary, isLoading: isLoadingFlowSummary, isError: isFlowSummaryError } = useRWAFlowSummary()
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [sorting, setSorting] = useState<SortingState>([{ id: 'activeMcap.total', desc: true }])
	const [expanded, setExpanded] = useState<ExpandedState>({})
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])

	const [searchValue, setSearchValue] = useState('')
	const deferredSearchValue = useDeferredValue(searchValue)

	const assetsWithFlows = useMemo(() => createAssetTableRows(assets, flowSummary), [assets, flowSummary])

	const assetsData = useMemo(() => {
		if (!deferredSearchValue) return assetsWithFlows

		return matchSorter(assetsWithFlows, deferredSearchValue, {
			keys: ['assetName', 'ticker', 'parentPlatform'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [assetsWithFlows, deferredSearchValue])

	const columns = useMemo(
		() => createRWAAssetColumns(includeRwaPerps, isLoadingFlowSummary, isFlowSummaryError && !flowSummary),
		[flowSummary, includeRwaPerps, isFlowSummaryError, isLoadingFlowSummary]
	)

	const instance = useReactTable({
		data: assetsData,
		columns,
		state: {
			sorting,
			columnFilters,
			expanded,
			columnOrder
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		filterFromLeafRows: true,
		onExpandedChange: (updater) => startTransition(() => setExpanded(updater)),
		getSubRows: (row: any) => row.subRows,
		onSortingChange: (updater) => startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => startTransition(() => setColumnFilters(updater)),
		onColumnOrderChange: (updater) => startTransition(() => setColumnOrder(updater)),
		getFilteredRowModel: getFilteredRowModel(),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel()
	})

	const columnsOptions = useMemo(
		() =>
			columns.map((c: any) => {
				const headerName = typeof c.header === 'function' ? (c.id ?? (c.accessorKey as string)) : (c.header as string)
				return {
					name: headerName,
					key: c.id ?? (c.accessorKey as string),
					help: c.meta?.headerHelperText as string | undefined
				}
			}),
		[columns]
	)

	const selectedColumns = instance
		.getAllLeafColumns()
		.filter((col) => col.getIsVisible())
		.map((col) => col.id)

	const setColumnOptions = (newOptions: string[] | ((prev: string[]) => string[])) => {
		const resolvedOptions = Array.isArray(newOptions) ? newOptions : newOptions(selectedColumns)
		const ops = Object.fromEntries(
			instance.getAllLeafColumns().map((col) => [col.id, resolvedOptions.includes(col.id)])
		)
		instance.setColumnVisibility(ops)
	}

	return (
		<Panel padding="none">
			<PanelHeader className="justify-end">
				<PanelTitle as="h1">Assets Rankings</PanelTitle>
				<TableToolbarControlGroup className="justify-end lg:flex-nowrap">
					<label className={searchFieldInlineWrapperStyles}>
						<span className="sr-only">Search assets</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<input
							onInput={(e) => setSearchValue(e.currentTarget.value)}
							placeholder="Search assets..."
							className={searchFieldInputStyles}
						/>
					</label>
					<SelectWithCombobox
						allValues={columnsOptions}
						selectedValues={selectedColumns}
						setSelectedValues={setColumnOptions}
						nestedMenu={false}
						label={'Columns'}
						labelType="smol"
						variant="filter-responsive"
						size="md"
					/>
					<CSVDownloadButton
						prepareCsv={() =>
							prepareTableCsv({
								instance,
								filename: `rwa-assets${selectedChain !== 'All' ? `-${selectedChain.toLowerCase()}` : ''}`
							})
						}
						smol
						size="md"
					/>
				</TableToolbarControlGroup>
			</PanelHeader>
			<VirtualTable instance={instance} />
		</Panel>
	)
}

type AssetRow = IRWAAssetsOverview['assets'][0]
type AssetTableRow = AssetRow & {
	flowSummaries: Partial<Record<RWAFlowWindow, IRWAAssetFlowSummary>>
}

export function createAssetTableRows(
	assets: IRWAAssetsOverview['assets'],
	flowSummary: IRWAFlowSummaryResponse | undefined
): AssetTableRow[] {
	return assets.map((asset) => ({
		...asset,
		flowSummaries:
			asset.kind === 'spot'
				? {
						'7d': flowSummary?.windows['7d'].asset[asset.canonicalMarketId],
						'30d': flowSummary?.windows['30d'].asset[asset.canonicalMarketId]
					}
				: {}
	}))
}

const columnHelper = createColumnHelper<AssetTableRow>()
const PLATFORM_COLUMN_HELP = 'Platform associated with issuance, custody, trading, or management of the asset.'

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}

const formatAssetPlatforms = (asset: AssetRow) => getRwaPlatforms(asset.parentPlatform).join(', ')

const MIXED_ACTIVE_HEADER = 'Active Mcap or OI'
const MIXED_ACTIVE_HELP = `${definitions.activeMcap.description} For perps rows, this column shows open interest.`

export function getMetricColumnHeaders(includeRwaPerps: boolean) {
	return {
		active: includeRwaPerps ? MIXED_ACTIVE_HEADER : definitions.activeMcap.label,
		onChain: definitions.onChainMcap.label,
		defi: definitions.defiActiveTvl.label
	}
}

export function getActiveMetricValue(asset: AssetRow): number | null {
	switch (asset.kind) {
		case 'spot':
			return asset.activeMcap?.total ?? null
		case 'perps':
			return asset.openInterest
		default:
			return assertNever(asset)
	}
}

export function getOnChainMetricValue(asset: AssetRow): number | null {
	switch (asset.kind) {
		case 'spot':
			return asset.onChainMcap?.total ?? null
		case 'perps':
			return null
		default:
			return assertNever(asset)
	}
}

export function getDefiMetricValue(asset: AssetRow): number | null {
	switch (asset.kind) {
		case 'spot':
			return asset.defiActiveTvl?.total ?? null
		case 'perps':
			return null
		default:
			return assertNever(asset)
	}
}

export function getDefiUtilization(asset: AssetRow): number | undefined {
	const defiTvl = asset.defiActiveTvl?.total
	const activeMcap = asset.activeMcap?.total
	return defiTvl == null || activeMcap == null || activeMcap === 0 ? undefined : (defiTvl / activeMcap) * 100
}

function createAssetFlowColumn(window: RWAFlowWindow, isLoading: boolean, isUnavailable: boolean) {
	const is7d = window === '7d'
	const header = is7d ? definitions.flows.netFlow7d : definitions.flows.netFlow30d
	const description = is7d
		? definitions.flows.assetNetFlow7d.description
		: definitions.flows.assetNetFlow30d.description

	return columnHelper.accessor((asset) => asset.flowSummaries[window]?.flow ?? undefined, {
		id: is7d ? 'netFlow7d' : 'netFlow30d',
		header: header.label,
		cell: (info) => {
			if (isLoading) {
				return <RWAFlowValueShimmer label={`Loading ${header.label}`} />
			}
			if (isUnavailable) return <RWAFlowValueUnavailable />
			const summary = info.row.original.flowSummaries[window]
			const value = info.getValue()
			const display = <span className={getRWAFlowTextClass(value)}>{formatSignedRWAFlow(value)}</span>
			return summary ? (
				<Tooltip
					content={<RWAFlowSummaryTooltip description={description} summary={summary} />}
					className="justify-end underline decoration-dotted"
				>
					{display}
				</Tooltip>
			) : (
				display
			)
		},
		meta: {
			headerClassName: 'w-[144px]',
			align: 'end',
			headerHelperText: header.description
		}
	})
}

function MixedMetricCell({
	asset,
	value,
	breakdown,
	description
}: {
	asset: AssetRow
	value: number | null | undefined
	breakdown: Array<[string, number]> | null | undefined
	description: string
}) {
	if (asset.kind === 'spot') {
		return <TVLBreakdownCell value={value} breakdown={breakdown} description={description} />
	}

	return value != null ? (
		<span>{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</span>
	) : null
}

function createRWAAssetColumns(
	includeRwaPerps: boolean,
	isLoadingFlowSummary: boolean,
	isFlowSummaryUnavailable: boolean
) {
	const metricHeaders = getMetricColumnHeaders(includeRwaPerps)

	return [
		columnHelper.accessor((asset) => asset.assetName ?? asset.ticker, {
			id: 'name',
			header: 'Name',
			enableSorting: false,
			cell: (info) => {
				return (
					<span className="flex items-center gap-2">
						<span className="vf-row-index shrink-0" aria-hidden="true" />
						<span className="-my-1.5 flex flex-col overflow-hidden">
							{info.row.original.detailHref ? (
								<>
									<BasicLink
										href={info.row.original.detailHref}
										className="truncate label-md text-link hover:underline"
									>
										{info.row.original.assetName}
									</BasicLink>
									<span className="label-sm text-secondary">{getAssetSecondaryLabel(info.row.original)}</span>
								</>
							) : (
								<>
									<span className="truncate label-md" title={info.row.original.assetName}>
										{info.row.original.assetName}
									</span>
								</>
							)}
						</span>
					</span>
				)
			},
			meta: {
				headerClassName: 'w-[180px] sm:w-[240px]'
			}
		}),
		columnHelper.accessor((asset) => normalizeRwaAssetGroup(asset.assetGroup), {
			id: 'assetGroup',
			header: 'Asset Group',
			cell: (info) => {
				const value = info.getValue()
				return <span className="truncate">{value}</span>
			},
			enableSorting: false,
			meta: {
				headerClassName: 'w-[168px]',
				align: 'end'
			}
		}),
		columnHelper.accessor((asset) => asset.price ?? undefined, {
			id: 'price',
			header: 'Token Price',
			cell: (info) =>
				info.getValue() != null ? (
					<span>
						{formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
					</span>
				) : null,
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end'
			}
		}),
		columnHelper.accessor((asset) => getActiveMetricValue(asset) ?? undefined, {
			id: 'activeMcap.total',
			header: metricHeaders.active,
			cell: (info) => (
				<MixedMetricCell
					asset={info.row.original}
					value={info.getValue()}
					breakdown={info.row.original.activeMcap?.breakdown}
					description={definitions.activeMcap.description}
				/>
			),
			meta: {
				headerClassName: 'w-[168px]',
				headerHelperText: includeRwaPerps ? MIXED_ACTIVE_HELP : definitions.activeMcap.description,
				align: 'end'
			}
		}),
		columnHelper.accessor((asset) => getOnChainMetricValue(asset) ?? undefined, {
			id: 'onChainMcap.total',
			header: metricHeaders.onChain,
			cell: (info) => (
				<MixedMetricCell
					asset={info.row.original}
					value={info.getValue()}
					breakdown={info.row.original.onChainMcap?.breakdown}
					description={definitions.onChainMcap.description}
				/>
			),
			meta: {
				headerClassName: 'w-[168px]',
				headerHelperText: definitions.onChainMcap.description,
				align: 'end'
			}
		}),
		columnHelper.accessor((asset) => getDefiMetricValue(asset) ?? undefined, {
			id: 'defiActiveTvl.total',
			header: metricHeaders.defi,
			cell: (info) => (
				<MixedMetricCell
					asset={info.row.original}
					value={info.getValue()}
					breakdown={info.row.original.defiActiveTvl?.breakdown}
					description={definitions.defiActiveTvl.description}
				/>
			),
			meta: {
				headerClassName: 'w-[168px]',
				headerHelperText: definitions.defiActiveTvl.description,
				align: 'end'
			}
		}),
		columnHelper.accessor((asset) => getDefiUtilization(asset), {
			header: 'DeFi Utilization',
			cell: (info) => (info.getValue() != null ? formatPercent(info.getValue(), { input: 'percent' }) : null),
			id: 'utilization',
			meta: {
				headerClassName: 'w-[140px]',
				align: 'end',
				headerHelperText: 'DeFi Active TVL / Active Mcap'
			}
		}),
		createAssetFlowColumn('7d', isLoadingFlowSummary, isFlowSummaryUnavailable),
		createAssetFlowColumn('30d', isLoadingFlowSummary, isFlowSummaryUnavailable),
		columnHelper.accessor((asset) => formatAssetPlatforms(asset), {
			id: 'platform',
			header: 'Platform',
			cell: (info) => {
				const platforms = getRwaPlatforms(info.row.original.parentPlatform)
				const value = platforms.join(', ')

				if (platforms.length === 1 && platforms[0] !== UNKNOWN_PLATFORM) {
					return (
						<BasicLink href={`/rwa/platform/${rwaSlug(platforms[0])}`} className="truncate text-link hover:underline">
							{value}
						</BasicLink>
					)
				}

				return (
					<Tooltip content={value} className="inline-block max-w-full justify-end truncate">
						{value}
					</Tooltip>
				)
			},
			enableSorting: false,
			meta: {
				headerClassName: 'w-[168px]',
				align: 'end',
				headerHelperText: PLATFORM_COLUMN_HELP
			}
		}),
		columnHelper.accessor((asset) => getAssetCategoryLabels(asset).join(', ') || undefined, {
			id: 'category',
			header: definitions.category.label,
			cell: (info) => {
				const value = getAssetCategoryLabels(info.row.original)
				if (value.length > 0) {
					return (
						<Tooltip
							content={
								<span className="flex flex-col gap-2">
									{value.map((category) => {
										const description = definitions.category.values?.[category]
										return (
											<span key={category}>
												<strong>{category}</strong>
												{description ? (
													<>
														<br />
														{description}
													</>
												) : null}
											</span>
										)
									})}
								</span>
							}
							className="inline-block max-w-full justify-end truncate"
						>
							{value.join(', ')}
						</Tooltip>
					)
				}
				return (
					<span title={value.join(', ')} className="truncate">
						{value.join(', ')}
					</span>
				)
			},
			enableSorting: false,
			meta: {
				headerClassName: 'w-[168px]',
				align: 'end',
				headerHelperText: definitions.category.description
			}
		}),
		columnHelper.accessor((asset) => asset.assetClass?.join(', ') ?? '', {
			id: 'assetClass',
			header: definitions.assetClass.label,
			cell: (info) => {
				const assetClasses = info.row.original.assetClass
				if (!assetClasses || assetClasses.length === 0) return null
				// For single asset class with definition, show tooltip
				if (assetClasses.length === 1) {
					const ac = assetClasses[0]
					const description = definitions.assetClass.values?.[ac]
					if (description) {
						return (
							<Tooltip content={description} className="inline-block max-w-full justify-end truncate">
								{ac}
							</Tooltip>
						)
					}
					return (
						<span className="inline-block max-w-full truncate" title={ac}>
							{ac}
						</span>
					)
				}
				// For multiple asset classes, show combined tooltip
				const tooltipContent = (
					<span className="flex flex-col gap-1">
						{assetClasses.map((ac) => {
							const description = definitions.assetClass.values?.[ac]
							return (
								<span key={ac}>
									<strong>{ac}</strong>: {description || 'No description'}
								</span>
							)
						})}
					</span>
				)
				return (
					<Hovercard
						content={tooltipContent}
						contentClassName="w-80 max-w-(--popover-available-width) p-3 whitespace-normal"
						className="inline-block max-w-full justify-end truncate"
					>
						{assetClasses.join(', ')}
					</Hovercard>
				)
			},
			enableSorting: false,
			meta: {
				headerClassName: 'w-[168px]',
				align: 'end',
				headerHelperText: definitions.assetClass.description
			}
		}),
		columnHelper.accessor((asset) => asset.accessModel ?? undefined, {
			id: 'accessModel',
			header: definitions.accessModel.label,
			cell: (info) => {
				const value = info.getValue()
				const valueDescription = definitions.accessModel.values?.[value]
				if (valueDescription) {
					return (
						<Tooltip
							content={valueDescription}
							className={clsx(
								'justify-end',
								value === 'Permissioned' && 'text-warning',
								value === 'Permissionless' && 'text-data-up',
								value === 'Non-transferable' && 'text-data-down',
								value === 'Custodial Only' && 'text-data-down'
							)}
						>
							{value}
						</Tooltip>
					)
				}
				return (
					<span
						className={clsx(
							'inline-block max-w-full truncate',
							value === 'Permissioned' && 'text-warning',
							value === 'Permissionless' && 'text-data-up',
							value === 'Non-transferable' && 'text-data-down',
							value === 'Custodial Only' && 'text-data-down'
						)}
					>
						{value}
					</span>
				)
			},
			enableSorting: false,
			meta: {
				headerClassName: 'w-[min(180px,40vw)]',
				align: 'end',
				headerHelperText: definitions.accessModel.description
			}
		}),
		columnHelper.accessor((asset) => asset.type ?? undefined, {
			id: 'type',
			header: definitions.type.label,
			cell: (info) => {
				const value = info.getValue()
				const tooltipContent = definitions.type.values?.[value]
				if (tooltipContent) {
					return (
						<Tooltip content={tooltipContent} className="inline-block max-w-full justify-end truncate">
							{value}
						</Tooltip>
					)
				}
				return (
					<span className="inline-block max-w-full truncate" title={value}>
						{value}
					</span>
				)
			},
			enableSorting: false,
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText: definitions.type.description
			}
		}),
		columnHelper.accessor((asset) => asset.rwaClassification ?? undefined, {
			id: 'rwaClassification',
			header: definitions.rwaClassification.label,
			cell: (info) => {
				const value = info.getValue()
				const isTrueRWA = info.row.original.trueRWA
				// If trueRWA flag, show green color with True RWA definition but display "RWA"
				const tooltipContent = isTrueRWA
					? definitions.rwaClassification.values?.['True RWA']
					: definitions.rwaClassification.values?.[value]
				if (tooltipContent) {
					return (
						<Tooltip
							content={tooltipContent}
							className={`inline-block max-w-full justify-end truncate ${isTrueRWA ? 'text-data-up' : ''}`}
						>
							{value}
						</Tooltip>
					)
				}
				return (
					<span className="inline-block max-w-full truncate" title={value}>
						{value}
					</span>
				)
			},
			enableSorting: false,
			meta: {
				headerClassName: 'w-[min(180px,40vw)]',
				align: 'end',
				headerHelperText: definitions.rwaClassification.description
			}
		}),
		columnHelper.accessor((asset) => asset.issuer ?? undefined, {
			id: 'issuer',
			header: definitions.issuer.label,
			cell: (info) => {
				const value = info.getValue()
				return (
					<span title={value} className="truncate">
						{value}
					</span>
				)
			},
			enableSorting: false,
			meta: {
				headerClassName: 'w-[168px]',
				align: 'end',
				headerHelperText: definitions.issuer.description
			}
		}),
		columnHelper.accessor((asset) => asset.redeemable ?? undefined, {
			id: 'redeemable',
			header: definitions.redeemable.label,
			cell: (info) => (
				<span className={info.getValue() ? 'text-data-up' : 'text-data-down'}>
					{info.getValue() != null ? (info.getValue() ? 'Yes' : 'No') : null}
				</span>
			),
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText: definitions.redeemable.description
			}
		}),
		columnHelper.accessor((asset) => asset.attestations ?? undefined, {
			id: 'attestations',
			header: definitions.attestations.label,
			cell: (info) => (
				<span className={info.getValue() ? 'text-data-up' : 'text-data-down'}>
					{info.getValue() != null ? (info.getValue() ? 'Yes' : 'No') : null}
				</span>
			),
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText: definitions.attestations.description
			}
		}),
		columnHelper.accessor((asset) => asset.cexListed ?? undefined, {
			id: 'cexListed',
			header: definitions.cexListed.label,
			cell: (info) => (
				<span className={info.getValue() ? 'text-data-up' : 'text-data-down'}>
					{info.getValue() != null ? (info.getValue() ? 'Yes' : 'No') : null}
				</span>
			),
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText: definitions.cexListed.description
			}
		}),
		columnHelper.accessor((asset) => asset.kycForMintRedeem ?? undefined, {
			id: 'kycForMintRedeem',
			header: definitions.kycForMintRedeem.label,
			cell: (info) => (
				<span className={info.getValue() ? 'text-warning' : 'text-data-up'}>
					{info.getValue() != null ? (info.getValue() ? 'Yes' : 'No') : null}
				</span>
			),
			meta: {
				headerClassName: 'w-[min(188px,40vw)]',
				align: 'end',
				headerHelperText: definitions.kycForMintRedeem.description
			}
		}),
		columnHelper.accessor((asset) => asset.kycAllowlistedWhitelistedToTransferHold ?? undefined, {
			id: 'kycAllowlistedWhitelistedToTransferHold',
			header: definitions.kycAllowlistedWhitelistedToTransferHold.label,
			cell: (info) => (
				<span className={info.getValue() ? 'text-warning' : 'text-data-up'}>
					{info.getValue() != null ? (info.getValue() ? 'Yes' : 'No') : null}
				</span>
			),
			meta: {
				headerClassName: 'w-[min(332px,40vw)]',
				align: 'end',
				headerHelperText: definitions.kycAllowlistedWhitelistedToTransferHold.description
			}
		}),
		columnHelper.accessor((asset) => asset.transferable ?? undefined, {
			id: 'transferable',
			header: definitions.transferable.label,
			cell: (info) => (
				<span className={info.getValue() ? 'text-data-up' : 'text-data-down'}>
					{info.getValue() != null ? (info.getValue() ? 'Yes' : 'No') : null}
				</span>
			),
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText: definitions.transferable.description
			}
		}),
		columnHelper.accessor((asset) => asset.selfCustody ?? undefined, {
			id: 'selfCustody',
			header: definitions.selfCustody.label,
			cell: (info) => (
				<span className={info.getValue() ? 'text-data-up' : 'text-data-down'}>
					{info.getValue() != null ? (info.getValue() ? 'Yes' : 'No') : null}
				</span>
			),
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText: definitions.selfCustody.description
			}
		})
	]
}

function getAssetSecondaryLabel(asset: AssetRow): string {
	switch (asset.kind) {
		case 'spot':
			return asset.ticker
		case 'perps':
			return asset.contract
		default:
			return assertNever(asset)
	}
}

function getAssetCategoryLabels(asset: AssetRow): string[] {
	if (asset.category && asset.category.length > 0) {
		return asset.category
	}

	if (asset.kind === 'perps') {
		return ['RWA Perp']
	}

	return []
}

const TVLBreakdownCell = ({
	value,
	breakdown,
	description
}: {
	value: number | null | undefined
	breakdown: Array<[string, number]> | null | undefined
	description: string
}) => {
	if (value == null) {
		return null
	}

	if (!breakdown || breakdown.length === 0) {
		return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
	}

	return (
		<Hovercard
			content={<BreakdownTooltipContent breakdown={breakdown} description={description} />}
			contentClassName="w-80 max-w-(--popover-available-width) p-3 whitespace-normal"
			className="justify-end underline decoration-dotted"
		>
			{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		</Hovercard>
	)
}
