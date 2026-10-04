import { useQuery } from '@tanstack/react-query'
import { createColumnHelper, type PaginationState, type SortingState } from '@tanstack/react-table'
import dynamic from 'next/dynamic'
import { startTransition, Suspense, useMemo, useState } from 'react'
import { useAuthContext } from '~/auth'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import type { TreemapChartProps } from '~/components/ECharts/TreemapChart/types'
import { BasicLink } from '~/components/Link'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { paginatedTableFeatures, usePaginatedTable } from '~/components/Table/features/pagination'
import { prepareTableCsv } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { fetchProtocolsByTokenClient } from '~/containers/TokenUsage/api'
import {
	buildTokenUsageTreemapTreeData,
	filterTokenUsageTreemapTreeData,
	getTokenUsageTreemapProtocolOptions,
	prepareTokenUsageTreemapCsv
} from '~/containers/TokenUsage/treemap'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TableToolbarControlGroup } from '~/ui/Toolbar'
import { formatUsd } from '~/utils/numberFormat'
import { DeferredPaginatedTable } from './deferred/DeferredPaginatedTable'
import { DEFAULT_TABLE_PAGE_SIZE, resolveUpdater, TABLE_PAGE_SIZE_OPTIONS } from './tableUtils'
import { TokenPrivateSectionGate } from './TokenPrivateSectionGate'
import { buildTokenUsageRows, filterTokenUsageRows, type TokenUsageSectionRow } from './TokenUsageSection.utils'

const tableFeaturesConfig = paginatedTableFeatures

type TokenUsageView = 'list' | 'treemap'

const DEFAULT_SORTING: SortingState = [{ desc: true, id: 'amountUsd' }]
const TOKEN_USAGE_SECTION_ID = 'token-usage'
const columnHelper = createColumnHelper<typeof tableFeaturesConfig, TokenUsageSectionRow>()
const TOKEN_USAGE_NAME_MAX_WIDTH = 'max-sm:max-w-[clamp(160px,40vw,260px)]'

const TreemapChart = dynamic(() => import('~/components/ECharts/TreemapChart'), {
	loading: () => <div className="min-h-[480px]" />
}) as React.FC<TreemapChartProps>

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()
			const href = row.original.slug ? `/protocol/${row.original.slug}` : null

			return (
				<span className="flex min-w-0 items-center gap-2">
					{row.original.logo ? (
						<TokenLogo src={row.original.logo} alt={`Logo of ${value}`} size={22} />
					) : (
						<TokenLogo name={value} kind="token" alt={`Logo of ${value}`} size={22} />
					)}
					{href ? (
						<BasicLink
							href={href}
							className={`min-w-0 truncate label-md text-link hover:underline ${TOKEN_USAGE_NAME_MAX_WIDTH}`}
						>
							{value}
						</BasicLink>
					) : (
						<span className={`min-w-0 truncate label-md ${TOKEN_USAGE_NAME_MAX_WIDTH}`}>{value}</span>
					)}
				</span>
			)
		}
	}),
	columnHelper.accessor('category', {
		header: 'Category',
		enableSorting: false
	}),
	columnHelper.accessor((row) => row.amountUsd ?? undefined, {
		id: 'amountUsd',
		header: 'Amount',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			align: 'end'
		}
	})
])

async function fetchTokenUsageRows(
	tokenSymbol: string,
	authorizedFetch: (url: string) => Promise<Response | null>
): Promise<Array<TokenUsageSectionRow>> {
	const data = await fetchProtocolsByTokenClient(tokenSymbol, authorizedFetch)
	return buildTokenUsageRows(data)
}

interface TokenUsageSectionProps {
	tokenSymbol: string
	initialIncludeCentralizedExchanges?: boolean
	initialPageSize?: (typeof TABLE_PAGE_SIZE_OPTIONS)[number]
}

export function TokenUsageSection({
	tokenSymbol,
	initialIncludeCentralizedExchanges = false,
	initialPageSize = DEFAULT_TABLE_PAGE_SIZE
}: TokenUsageSectionProps) {
	const { authorizedFetch, hasActiveSubscription, isAuthenticated, loaders } = useAuthContext()
	const { chartInstance: treemapChartInstance, handleChartReady: handleTreemapChartReady } = useGetChartInstance()
	const [includeCentralizedExchanges, setIncludeCentralizedExchanges] = useState(initialIncludeCentralizedExchanges)
	const [view, setView] = useState<TokenUsageView>('list')
	const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING)
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: initialPageSize
	})

	const {
		data: rows,
		error,
		isLoading
	} = useQuery({
		queryKey: ['token-usage', 'token-page', tokenSymbol],
		queryFn: () => fetchTokenUsageRows(tokenSymbol, authorizedFetch),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: Boolean(tokenSymbol) && isAuthenticated && hasActiveSubscription && !loaders.userLoading
	})

	const filteredRows = useMemo(
		() => filterTokenUsageRows(rows ?? [], includeCentralizedExchanges),
		[rows, includeCentralizedExchanges]
	)
	const tokenUsageTreemapRootLabel = `${tokenSymbol.toUpperCase()} usage`
	const tokenUsageExportTitle = `${tokenSymbol.toUpperCase()} token usage`
	const tokenUsageExportFilename = `token-usage-${tokenSymbol.toLowerCase()}`

	const canonicalTreemapTreeData = useMemo(
		() => (view === 'treemap' ? buildTokenUsageTreemapTreeData(filteredRows, tokenUsageTreemapRootLabel) : []),
		[view, filteredRows, tokenUsageTreemapRootLabel]
	)
	const treemapProtocolOptions = useMemo(
		() => getTokenUsageTreemapProtocolOptions(canonicalTreemapTreeData),
		[canonicalTreemapTreeData]
	)
	const treemapProtocolKeys = useMemo(
		() => treemapProtocolOptions.map((option) => option.key),
		[treemapProtocolOptions]
	)
	const {
		activeSeries: selectedTreemapProtocols,
		selectedCharts: selectedTreemapProtocolSet,
		setSelectedSeries: setSelectedTreemapProtocols
	} = useLocalSelection({ allowEmptySelection: true, availableSeries: treemapProtocolKeys, scope: tokenSymbol })
	const treemapTreeData = useMemo(
		() => filterTokenUsageTreemapTreeData(canonicalTreemapTreeData, selectedTreemapProtocolSet),
		[canonicalTreemapTreeData, selectedTreemapProtocolSet]
	)

	const table = usePaginatedTable({
		data: filteredRows,
		columns,
		state: {
			sorting,
			pagination
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => startTransition(() => setSorting(resolveUpdater(updater, sorting))),
		onPaginationChange: (updater) => startTransition(() => setPagination(resolveUpdater(updater, pagination))),
		autoResetPageIndex: false
	})

	return (
		<TokenPrivateSectionGate
			title="Token Usage"
			sectionId={TOKEN_USAGE_SECTION_ID}
			contentLabel="token usage"
			isLoading={isLoading}
			error={error}
			errorMessage="Failed to load token usage."
			emptyMessage={filteredRows.length === 0 ? 'No token usage entries found.' : null}
			headerActions={
				isAuthenticated && hasActiveSubscription && rows ? (
					<TableToolbarControlGroup>
						<Checkbox
							variant="filter"
							value="includeCentralizedExchanges"
							checked={includeCentralizedExchanges}
							onChange={() =>
								startTransition(() => {
									setIncludeCentralizedExchanges((prev) => !prev)
									setPagination((prev) => ({ ...prev, pageIndex: 0 }))
								})
							}
						>
							Include CEXs
						</Checkbox>
						<SegmentedControl
							value={view}
							onValueChange={(value) => setView(value as typeof view)}
							options={[
								{
									value: 'list',
									label: (
										<>
											<Icon name="align-left" height={14} width={14} />
											<span>List</span>
										</>
									)
								},
								{
									value: 'treemap',
									label: (
										<>
											<Icon name="layout-grid" height={14} width={14} />
											<span>Treemap</span>
										</>
									)
								}
							]}
							label="View"
							variant="default"
							size="md"
							buttonClassName="flex items-center gap-1"
						/>
						{view === 'treemap' && treemapProtocolOptions.length > 1 ? (
							<SelectWithCombobox
								allValues={treemapProtocolOptions}
								selectedValues={selectedTreemapProtocols}
								setSelectedValues={setSelectedTreemapProtocols}
								label="Protocol"
								labelType="smol"
								variant="filter"
								size="md"
							/>
						) : null}
						{view === 'treemap' ? (
							<>
								<ChartRestoreButton chartInstance={treemapChartInstance} />
								<ChartPngExportButton
									chartInstance={treemapChartInstance}
									filename={tokenUsageExportFilename}
									title={tokenUsageExportTitle}
								/>
							</>
						) : null}
						<CSVDownloadButton
							prepareCsv={() =>
								view === 'treemap'
									? prepareTokenUsageTreemapCsv(treemapTreeData, tokenUsageExportFilename)
									: prepareTableCsv({
											instance: table,
											filename: `token-usage-${tokenSymbol}`
										})
							}
							smol
							size="md"
						/>
					</TableToolbarControlGroup>
				) : null
			}
		>
			{view === 'treemap' ? (
				<TreemapChart
					treeData={treemapTreeData}
					variant="rwa"
					height="480px"
					valueLabel="Amount"
					valueSymbol="$"
					onReady={handleTreemapChartReady}
				/>
			) : (
				<Suspense fallback={<div className="min-h-[360px]" />}>
					<DeferredPaginatedTable
						table={table}
						pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
						tableClassName="mx-auto w-auto min-w-[720px] max-w-full"
					/>
				</Suspense>
			)}
		</TokenPrivateSectionGate>
	)
}
