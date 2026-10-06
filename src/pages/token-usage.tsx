import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { createColumnHelper, type SortingState, useTable } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { lazy, startTransition, Suspense, useMemo, useState } from 'react'
import { useAuthContext } from '~/auth'
import { Announcement } from '~/components/Announcement'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import type { TreemapChartProps } from '~/components/ECharts/TreemapChart/types'
import { BasicLink } from '~/components/Link'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { displayTableFeatures } from '~/components/Table/features/display'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { searchTokens } from '~/containers/TokenSearch/search'
import { fetchProtocolsByTokenClient } from '~/containers/TokenUsage/api'
import {
	buildTokenUsageTreemapTreeData,
	filterTokenUsageTreemapTreeData,
	getTokenUsageTreemapProtocolOptions,
	getTokenUsageTreemapTotal,
	prepareTokenUsageTreemapCsv
} from '~/containers/TokenUsage/treemap'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useIsClient } from '~/hooks/useIsClient'
import Layout from '~/layout'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { searchFieldInputStyles } from '~/ui/Input'
import { NoResults } from '~/ui/NoResults'
import { Panel } from '~/ui/Panel'
import { popoverRowWithBorderStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { LoadingIndicator, PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'

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

const columnHelper = createColumnHelper<typeof displayTableFeatures, TokenUsagePageRow>()

export default function Tokens() {
	const router = useRouter()
	const isClient = useIsClient()
	const { authorizedFetch, hasActiveSubscription, isAuthenticated, loaders } = useAuthContext()
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
	} = useLocalSelection({
		allowEmptySelection: true,
		availableSeries: treemapProtocolKeys,
		scope: tokenSymbol ?? 'none'
	})
	const treemapTreeData = useMemo(
		() => filterTokenUsageTreemapTreeData(canonicalTreemapTreeData, selectedTreemapProtocolSet),
		[canonicalTreemapTreeData, selectedTreemapProtocolSet]
	)
	const totalTrackedUsd = useMemo(() => getTokenUsageTreemapTotal(treemapTreeData), [treemapTreeData])

	const [sorting, setSorting] = useState<SortingState>([{ desc: true, id: 'amountUsd' }])
	const tableInstance = useTable({
		features: displayTableFeatures,
		data: filteredProtocols,
		columns,
		state: {
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => startTransition(() => setSorting(updater))
	})

	return (
		<Layout
			title="DeFi Token Usage Tracker - DefiLlama"
			description="Track how tokens are used across DeFi protocols and CEXs. View token utility, protocol integrations, and on-chain usage data."
			canonicalUrl="/token-usage"
			pageName={pageName}
		>
			<Announcement notCancellable>This is not an exhaustive list</Announcement>

			<TokenUsageSearch />

			{!isClient || isLoading || !router.isReady || loaders.userLoading ? (
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
							An active subscription is required to view token usage.{' '}
							<button type="button" onClick={signInDialogStore.show} className="underline">
								Sign in
							</button>
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
					<ChartPanelToolbar>
						<div className="mr-auto flex flex-col">
							<h2 className="heading-xs">{`${tokenSymbol.toUpperCase()} usage in protocols`}</h2>
							<p className="flex items-center gap-1 body-sm" title="Sum of amounts for currently selected protocols">
								<span className="font-jetbrains font-bold">
									{formatUsd(totalTrackedUsd, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</span>
								<span className="text-secondary">total tracked</span>
							</p>
						</div>

						<div className="flex flex-wrap items-center justify-end gap-1.5">
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
						<VirtualTable table={tableInstance} />
					</Suspense>
				</Panel>
			)}
			<SignInModal store={signInDialogStore} />
		</Layout>
	)
}

const fetchProtocols = async (
	tokenSymbol: string | null,
	authorizedFetch: (url: string) => Promise<Response | null>
): Promise<Array<TokenUsagePageRow> | null> => {
	if (!tokenSymbol) return null
	const data = await fetchProtocolsByTokenClient(tokenSymbol, authorizedFetch)
	return (
		data?.map((p) => ({ ...p, amountUsd: Object.values(p.amountUsd).reduce((s: number, a: number) => s + a, 0) })) ?? []
	)
}

const columns = columnHelper.columns([
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
						<BasicLink href={href} className="truncate label-md text-link hover:underline">
							{value}
						</BasicLink>
					) : (
						<span className="truncate label-md">{value}</span>
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
			headerClassName: 'w-[140px]'
		}
	}),
	columnHelper.accessor((row) => row.amountUsd ?? undefined, {
		id: 'amountUsd',
		header: 'Amount',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	})
])

function getPreHydrationTokenSearchValue() {
	if (typeof window === 'undefined') return ''
	const input = document.getElementById('token-usage-search-input')
	return input instanceof HTMLInputElement ? input.value : ''
}

export function TokenUsageSearch() {
	const router = useRouter()

	// Null until the reader types, including text typed before hydration; until then the URL token shows, which a
	// static page's query holds only once the router is ready. Clearing the field stores '' and keeps it empty.
	const [typedValue, setTypedValue] = useState<string | null>(() => getPreHydrationTokenSearchValue() || null)
	const urlToken = router.isReady ? readSingleQueryValue(router.query.token) : undefined
	const searchValue = typedValue ?? urlToken?.toUpperCase() ?? ''

	const debouncedSearchValue = useDebouncedValue(searchValue, 200)
	const { data, isLoading, error } = useQuery({
		queryKey: ['token-usage', 'search-tokens', debouncedSearchValue],
		queryFn: () => searchTokens(debouncedSearchValue, 20),
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const [open, setOpen] = useState(false)

	return (
		<Ariakit.ComboboxProvider
			inputValue={searchValue}
			setInputValue={(nextValue) => {
				startTransition(() => {
					setTypedValue(nextValue)
				})
			}}
			open={open}
			setOpen={setOpen}
		>
			<span className="relative isolate w-full lg:max-w-[50vw]">
				<button
					type="button"
					onClick={() => setOpen((prev) => !prev)}
					className="absolute top-1 bottom-1 left-2 my-auto opacity-50"
				>
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

			<ComboboxSurface
				variant="search-results"
				sameWidth
				className="max-h-[min(400px,var(--popover-available-height))]"
			>
				{isLoading ? (
					<p role="status" aria-live="polite" className="flex justify-center px-3 py-6">
						<LoadingIndicator />
					</p>
				) : error ? (
					<p className="px-3 py-6 text-center body-sm text-data-down" role="alert">{`Error: ${error.message}`}</p>
				) : !data?.length ? (
					<NoResults />
				) : (
					<Ariakit.ComboboxList>
						{data.map((tokenResult) => (
							<Ariakit.ComboboxItem
								key={tokenResult.id}
								value={tokenResult.name}
								onClick={() => {
									void pushShallowQuery(router, { token: tokenResult.symbol }).then(() => {
										setOpen(false)
									})
								}}
								focusOnHover
								hideOnClick={false}
								setValueOnClick
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
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
