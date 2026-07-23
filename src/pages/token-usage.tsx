import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import {
	createColumnHelper,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { lazy, startTransition, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { Announcement } from '~/components/Announcement'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import type { TreemapChartProps } from '~/components/ECharts/TreemapChart/types'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { VirtualTable } from '~/components/Table/Table'
import { TokenLogo } from '~/components/TokenLogo'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { searchTokens } from '~/containers/TokenSearch/search'
import { fetchProtocolsByTokenClient } from '~/containers/TokenUsage/api'
import {
	buildTokenUsageTreemapTreeData,
	filterTokenUsageTreemapTreeData,
	getTokenUsageTreemapProtocolOptions,
	prepareTokenUsageTreemapCsv
} from '~/containers/TokenUsage/treemap'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useIsClient } from '~/hooks/useIsClient'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import Layout from '~/layout'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { searchFieldInputStyles } from '~/ui/Input'
import { NoResults } from '~/ui/NoResults'
import { Panel } from '~/ui/Panel'
import {
	popoverRowWithBorderStyles,
	popoverSurfaceStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { formattedNum } from '~/utils'
import { pushShallowQuery } from '~/utils/routerQuery'

const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<TreemapChartProps>

const pageName = ['Token', 'usage in', 'Protocols']

type TokenUsagePageRow = {
	name: string
	amountUsd: number
	category?: string
	logo?: string
	slug?: string
	misrepresentedTokens?: boolean
}

const columnHelper = createColumnHelper<TokenUsagePageRow>()

export default function Tokens() {
	const router = useRouter()
	const isClient = useIsClient()
	const { authorizedFetch, hasActiveSubscription, isAuthenticated } = useAuthContext()
	const { chartInstance: treemapChartInstance, handleChartReady: handleTreemapChartReady } = useGetChartInstance()
	const signInDialogStore = Ariakit.useDialogStore()

	const { token, includecex } = router.query

	const tokenSymbol = token ? (typeof token === 'string' ? token : token[0]) : null
	const includeCentraliseExchanges = includecex === 'true'

	const {
		data: protocols,
		error,
		isLoading
	} = useQuery({
		queryKey: ['token-usage', 'protocols-by-token', tokenSymbol],
		queryFn: () => fetchProtocols(tokenSymbol, authorizedFetch),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: !!tokenSymbol && isAuthenticated && !!hasActiveSubscription
	})

	const filteredProtocols = useMemo(() => {
		return (
			protocols?.filter(
				(protocol) =>
					!protocol.misrepresentedTokens &&
					(protocol.category?.toLowerCase() === 'cex' ? includeCentraliseExchanges : true)
			) ?? []
		)
	}, [protocols, includeCentraliseExchanges])
	const tokenUsageTreemapRootLabel = tokenSymbol ? `${tokenSymbol.toUpperCase()} usage` : 'Token usage'
	const tokenUsageExportTitle = tokenSymbol ? `${tokenSymbol.toUpperCase()} token usage` : 'Token usage'
	const tokenUsageExportFilename = tokenSymbol ? `token-usage-${tokenSymbol.toLowerCase()}` : 'token-usage'
	const canonicalTreemapTreeData = useMemo(
		() => buildTokenUsageTreemapTreeData(filteredProtocols, tokenUsageTreemapRootLabel),
		[filteredProtocols, tokenUsageTreemapRootLabel]
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
	} = useAllSeriesSelection({
		availableSeries: treemapProtocolKeys,
		selectionKey: tokenSymbol ?? 'none'
	})
	const treemapTreeData = useMemo(
		() => filterTokenUsageTreemapTreeData(canonicalTreemapTreeData, selectedTreemapProtocolSet),
		[canonicalTreemapTreeData, selectedTreemapProtocolSet]
	)

	const [sorting, setSorting] = useState<SortingState>([{ desc: true, id: 'amountUsd' }])
	const tableInstance = useReactTable({
		data: filteredProtocols,
		columns,
		state: {
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => startTransition(() => setSorting(updater)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	})

	return (
		<Layout
			title="DeFi Token Usage Tracker - DefiLlama"
			description="Track how tokens are used across DeFi protocols and CEXs. View token utility, protocol integrations, and on-chain usage data."
			canonicalUrl={`/token-usage`}
			pageName={pageName}
		>
			<Announcement notCancellable>This is not an exhaustive list</Announcement>

			<TokenUsageSearch />

			{!isClient || isLoading || !router.isReady ? (
				<PanelLoadingStatus className="min-h-[380px]" />
			) : error ? (
				<PanelStatus variant="error" className="min-h-[380px]">
					{error.message}
				</PanelStatus>
			) : !tokenSymbol ? (
				<PanelStatus variant="empty" className="min-h-[380px]">
					No token selected
				</PanelStatus>
			) : !isAuthenticated || !hasActiveSubscription ? (
				<PanelStatus variant="empty" className="min-h-[380px]">
					{!isAuthenticated ? (
						<>
							An{' '}
							<button type="button" onClick={signInDialogStore.show} className="underline">
								active subscription
							</button>{' '}
							is required to view token usage.
						</>
					) : (
						<>
							An{' '}
							<BasicLink href="/subscription" className="underline">
								active subscription
							</BasicLink>{' '}
							is required to view token usage.
						</>
					)}
				</PanelStatus>
			) : !protocols || protocols.length === 0 ? (
				<PanelStatus variant="empty" className="min-h-[380px]">
					No protocols found
				</PanelStatus>
			) : (
				<Panel padding="none" className="w-full flex-1">
					<ChartPanelToolbar className="items-center justify-between">
						<h2 className="mr-auto flex w-full grow heading-xs sm:w-auto">{`${tokenSymbol.toUpperCase()} usage in protocols`}</h2>

						<div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 max-sm:w-full">
							<Checkbox
								variant="filter"
								value="includeCentraliseExchanges"
								checked={includeCentraliseExchanges}
								onChange={() => {
									void pushShallowQuery(router, {
										includecex: !includeCentraliseExchanges ? 'true' : undefined
									})
								}}
							>
								Include CEXs
							</Checkbox>
							{treemapProtocolOptions.length > 1 ? (
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
							{treemapTreeData.length > 0 ? (
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
								prepareCsv={() => prepareTokenUsageTreemapCsv(treemapTreeData, tokenUsageExportFilename)}
								smol
								size="md"
							/>
						</div>
					</ChartPanelToolbar>

					{treemapTreeData.length > 0 ? (
						<Suspense fallback={<div style={{ height: '480px' }} />}>
							<TreemapChart
								treeData={treemapTreeData}
								variant="rwa"
								height="480px"
								valueLabel="Amount"
								valueSymbol="$"
								onReady={handleTreemapChartReady}
							/>
						</Suspense>
					) : null}

					<Suspense
						fallback={<div style={{ minHeight: `${filteredProtocols.length * 50 + 200}px` }} className="bg-surface" />}
					>
						<VirtualTable instance={tableInstance} />
					</Suspense>
				</Panel>
			)}
			<SignInModal store={signInDialogStore} hideWhenAuthenticated={false} />
		</Layout>
	)
}

const fetchProtocols = async (
	tokenSymbol: string | null,
	authorizedFetch: (url: string) => Promise<Response | null>
): Promise<TokenUsagePageRow[] | null> => {
	if (!tokenSymbol) return null
	try {
		const data = await fetchProtocolsByTokenClient(tokenSymbol, authorizedFetch)
		return (
			data?.map((p) => ({ ...p, amountUsd: Object.values(p.amountUsd).reduce((s: number, a: number) => s + a, 0) })) ??
			[]
		)
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : 'Failed to fetch')
	}
}

const columns = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()
			const href = row.original.slug ? `/protocol/${row.original.slug}` : null

			return (
				<span className="flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo name={row.original.slug ?? value} kind="token" data-lgonly alt={`Logo of ${value}`} />
					{href ? (
						<BasicLink href={href} className="truncate text-sm font-medium text-link hover:underline">
							{value}
						</BasicLink>
					) : (
						<span className="truncate text-sm font-medium">{value}</span>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(240px,40vw)]'
		}
	}),
	columnHelper.accessor('category', {
		header: 'Category',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('amountUsd', {
		header: 'Amount',
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	})
]

function getPreHydrationTokenSearchValue() {
	if (typeof window === 'undefined') return ''
	const input = document.getElementById('token-usage-search-input')
	return input instanceof HTMLInputElement ? input.value : ''
}

export const TokenUsageSearch = () => {
	const router = useRouter()

	const [searchValue, setSearchValue] = useState(getPreHydrationTokenSearchValue)
	useEffect(() => {
		if (!router.isReady) return
		const token = Array.isArray(router.query.token) ? router.query.token[0] : router.query.token
		setSearchValue((currentValue) => currentValue || token?.toUpperCase() || '')
	}, [router.isReady, router.query.token])

	const debouncedSearchValue = useDebouncedValue(searchValue, 200)
	const { data, isLoading, error } = useQuery({
		queryKey: ['token-usage', 'search-tokens', debouncedSearchValue],
		queryFn: () => searchTokens(debouncedSearchValue, 20),
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const [open, setOpen] = useState(false)

	const comboboxRef = useRef<HTMLDivElement>(null)

	return (
		<Ariakit.ComboboxProvider
			value={searchValue}
			setValue={(nextValue) => {
				startTransition(() => {
					setSearchValue(nextValue)
				})
			}}
			open={open}
			setOpen={setOpen}
		>
			<span className="relative isolate w-full lg:max-w-[50vw]">
				<button onClick={() => setOpen((prev) => !prev)} className="absolute top-1 bottom-1 left-2 my-auto opacity-50">
					{open ? (
						<>
							<span className="sr-only">Close Search</span>
							<Icon name="x" height={18} width={18} />
						</>
					) : (
						<>
							<span className="sr-only">Open Search</span>
							<Icon name="search" height={16} width={16} />
						</>
					)}
				</button>

				<Ariakit.Combobox
					id="token-usage-search-input"
					placeholder="Search tokens..."
					autoSelect
					className={searchFieldInputStyles}
				/>
			</span>

			<Ariakit.ComboboxPopover
				unmountOnHide
				hideOnInteractOutside
				gutter={6}
				sameWidth
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={popoverSurfaceStyles}
				portal
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>
				{isLoading ? (
					<p className="px-3 py-6 text-center body-sm text-tertiary">Loading...</p>
				) : error ? (
					<p className="px-3 py-6 text-center body-sm text-data-down" role="alert">{`Error: ${error.message}`}</p>
				) : !data?.length ? (
					<NoResults />
				) : (
					<Ariakit.ComboboxList ref={comboboxRef}>
						{data.map((tokenResult) => (
							<Ariakit.ComboboxItem
								key={`token-usage-${tokenResult.name}`}
								value={tokenResult.name}
								onClick={() => {
									void pushShallowQuery(router, { token: tokenResult.symbol }).then(() => {
										setOpen(false)
									})
								}}
								focusOnHover
								hideOnClick={false}
								setValueOnClick={true}
								className={`${popoverRowWithBorderStyles} justify-start gap-4 aria-disabled:opacity-50`}
							>
								{tokenResult?.logo ? (
									<TokenLogo src={tokenResult?.logo} alt={`Logo of ${tokenResult?.name ?? ''}`} />
								) : null}
								<span>{tokenResult.name}</span>
							</Ariakit.ComboboxItem>
						))}
					</Ariakit.ComboboxList>
				)}
			</Ariakit.ComboboxPopover>
		</Ariakit.ComboboxProvider>
	)
}
