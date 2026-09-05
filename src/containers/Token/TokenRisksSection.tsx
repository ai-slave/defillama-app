import * as Ariakit from '@ariakit/react'
import type { PaginationState, SortingState } from '@tanstack/react-table'
import {
	createColumnHelper,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable
} from '@tanstack/react-table'
import { startTransition, Suspense, useMemo, useState } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { popoverHovercardSurfaceStyles } from '~/ui/Popover'
import { formatUsd } from '~/utils/numberFormat'
import { DeferredPaginatedTable } from './deferred/DeferredPaginatedTable'
import { DEFAULT_TABLE_PAGE_SIZE, resolveUpdater, TABLE_PAGE_SIZE_OPTIONS } from './tableUtils'
import type {
	TokenRiskChainExposureSummary,
	TokenRiskCoverageStatus,
	TokenRiskExposureRow,
	TokenRiskProtocolSummary,
	TokenRiskResponse
} from './tokenRisk.types'

const TOKEN_RISKS_SECTION_ID = 'token-risks'
const exposureColumnHelper = createColumnHelper<TokenRiskExposureRow>()
const DEFAULT_EXPOSURES_SORTING: SortingState = [{ id: 'currentMaxBorrowUsd', desc: true }]

function formatRiskUsd(value: number | null | undefined) {
	if (value == null) return 'Unavailable'
	return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
}

function TableEntityCell({
	label,
	logoName,
	logoKind,
	title
}: {
	label: string
	logoName: string
	logoKind: 'token' | 'chain'
	title?: string
}) {
	return (
		<div className="flex items-center gap-2">
			<TokenLogo name={logoName} kind={logoKind} size={18} alt={`Logo of ${label}`} title={title} />
			<span>{label}</span>
		</div>
	)
}

function formatProtocolChains(chainBreakdowns: TokenRiskChainExposureSummary[]) {
	if (chainBreakdowns.length === 0) return ''
	if (chainBreakdowns.length === 1) return chainBreakdowns[0]!.chainDisplayName
	return `${chainBreakdowns.length} chains`
}

function formatMinBadDebtValue(value: number | null | undefined, coverage: TokenRiskCoverageStatus) {
	if (coverage === 'unavailable' || value == null) return '—'
	if (coverage === 'partial')
		return `${formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} (partial)`
	return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
}

function formatProtocolSummaryBadDebt(value: number | null | undefined) {
	if (value == null) return '--'
	return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
}

function ProtocolExposureSummaryText({
	summary,
	tokenSymbol
}: {
	summary: TokenRiskProtocolSummary
	tokenSymbol: string
}) {
	const totalAtRiskUsd = summary.totalCurrentMaxBorrowUsd + (summary.totalMinBadDebtAtPriceZeroUsd ?? 0)

	return (
		<>
			{formatRiskUsd(totalAtRiskUsd)} at-risk exposure ={' '}
			{formatProtocolSummaryBadDebt(summary.totalMinBadDebtAtPriceZeroUsd)} bad debt if hacked +{' '}
			{formatRiskUsd(summary.totalCurrentMaxBorrowUsd)} additional borrowable against {tokenSymbol}
		</>
	)
}

function ChainBreakdownTooltipContent({ chainBreakdowns }: { chainBreakdowns: TokenRiskChainExposureSummary[] }) {
	return (
		<div className="w-80 max-w-(--popover-available-width) space-y-2 body-sm">
			<p className="font-medium text-primary">Breakdown by chain</p>
			<div className="space-y-1">
				{chainBreakdowns.map((chain) => (
					<div
						key={`${chain.chain}-${chain.chainDisplayName}`}
						className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-subtle pb-1 last:border-b-0 last:pb-0"
					>
						<span className="flex min-w-0 items-center gap-1.5 font-medium text-primary">
							<TokenLogo
								name={chain.chainDisplayName}
								kind="chain"
								size={14}
								alt={`Logo of ${chain.chainDisplayName}`}
								title={chain.chain}
							/>
							<span className="truncate" title={chain.chainDisplayName}>
								{chain.chainDisplayName}
							</span>
						</span>
						<span className="text-right text-primary">
							{formatRiskUsd(chain.totalCurrentMaxBorrowUsd + (chain.totalMinBadDebtAtPriceZeroUsd ?? 0))}
						</span>
						<span className="text-secondary">Bad debt if hacked</span>
						<span className="text-right text-secondary">
							{formatMinBadDebtValue(chain.totalMinBadDebtAtPriceZeroUsd, chain.minBadDebtAtPriceZeroCoverage)}
						</span>
						<span className="text-secondary">Additional borrowable</span>
						<span className="text-right text-secondary">{formatRiskUsd(chain.totalCurrentMaxBorrowUsd)}</span>
					</div>
				))}
			</div>
		</div>
	)
}

function ProtocolChainsLabel({ chainBreakdowns }: { chainBreakdowns: TokenRiskChainExposureSummary[] }) {
	const label = formatProtocolChains(chainBreakdowns)
	if (!label) return null

	return (
		<Ariakit.HovercardProvider placement="bottom-start" timeout={150}>
			<Ariakit.HovercardAnchor
				render={
					<button
						type="button"
						className="cursor-help text-left body-sm text-secondary underline decoration-dotted underline-offset-2 hover:text-primary focus-visible:text-primary"
						aria-label={`Show ${label} exposure breakdown by chain`}
					/>
				}
			>
				{label}
			</Ariakit.HovercardAnchor>
			<Ariakit.Hovercard
				className={`${popoverHovercardSurfaceStyles} p-3`}
				gutter={6}
				overflowPadding={16}
				portal
				unmountOnHide
			>
				<ChainBreakdownTooltipContent chainBreakdowns={chainBreakdowns} />
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}

function createExposureColumns(methodologies: TokenRiskResponse['exposures']['methodologies']) {
	return [
		exposureColumnHelper.accessor('protocolDisplayName', {
			header: 'Protocol',
			enableSorting: false,
			cell: ({ row, getValue }) => (
				<TableEntityCell label={getValue()} logoName={getValue()} logoKind="token" title={row.original.protocol} />
			)
		}),
		exposureColumnHelper.accessor('chainDisplayName', {
			header: 'Chain',
			enableSorting: false,
			cell: ({ row, getValue }) => (
				<TableEntityCell label={getValue()} logoName={getValue()} logoKind="chain" title={row.original.chain} />
			)
		}),
		exposureColumnHelper.accessor('assetSymbol', {
			header: 'Asset',
			cell: ({ row, getValue }) => (
				<div className="flex flex-col">
					<span>{getValue()}</span>
					<span className="mono-sm text-secondary">{row.original.assetAddress}</span>
				</div>
			),
			meta: {
				headerHelperText: methodologies.asset
			}
		}),
		exposureColumnHelper.accessor((row) => row.currentMaxBorrowUsd ?? undefined, {
			id: 'currentMaxBorrowUsd',
			header: 'Max Borrowable',
			cell: ({ getValue }) => formatRiskUsd(getValue()),
			meta: {
				align: 'end',
				headerHelperText: methodologies.currentMaxBorrowUsd
			}
		}),
		exposureColumnHelper.accessor((row) => row.minBadDebtAtPriceZeroUsd ?? undefined, {
			id: 'minBadDebtAtPriceZeroUsd',
			header: 'Bad Debt at $0',
			cell: ({ row, getValue }) => formatMinBadDebtValue(getValue(), row.original.minBadDebtAtPriceZeroCoverage),
			meta: {
				align: 'end',
				headerHelperText: methodologies.minBadDebtAtPriceZeroUsd
			}
		})
	]
}

export function TokenRisksSection({ tokenSymbol, riskData }: { tokenSymbol: string; riskData: TokenRiskResponse }) {
	const { exposures, scopeCandidates } = riskData
	const [sorting, setSorting] = useState<SortingState>(DEFAULT_EXPOSURES_SORTING)
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: DEFAULT_TABLE_PAGE_SIZE
	})

	const exposureColumns = useMemo(() => createExposureColumns(exposures.methodologies), [exposures.methodologies])

	const exposureTable = useReactTable({
		defaultColumn: { sortUndefined: 'last' },
		data: exposures.rows,
		columns: exposureColumns,
		state: {
			sorting,
			pagination
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => startTransition(() => setSorting(resolveUpdater(updater, sorting))),
		onPaginationChange: (updater) => startTransition(() => setPagination(resolveUpdater(updater, pagination))),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})

	const selectedCandidateDisplayName = scopeCandidates.length === 1 ? scopeCandidates[0]!.displayName : 'onchain'

	const totalMaxExposureUsd =
		exposures.summary.totalCurrentMaxBorrowUsd + (exposures.summary.totalMinBadDebtAtPriceZeroUsd ?? 0)

	if (exposures.rows.length === 0) {
		return null
	}

	return (
		<Panel padding="none">
			<PanelHeader>
				<div className="min-w-0">
					<PanelTitle
						className="group relative flex min-w-0 scroll-mt-24 items-center gap-1"
						id={TOKEN_RISKS_SECTION_ID}
					>
						Risks
						<a
							aria-hidden="true"
							tabIndex={-1}
							href={`#${TOKEN_RISKS_SECTION_ID}`}
							className="absolute top-0 right-0 z-10 flex size-full items-center"
						/>
						<Icon name="link" className="invisible size-3.5 group-hover:visible group-focus-visible:visible" />
					</PanelTitle>
					<p className="mt-1 max-w-4xl body-md text-secondary">
						How much debt can be issued against {tokenSymbol} as collateral across lending protocols.
					</p>
				</div>
			</PanelHeader>

			<div className="flex flex-1 flex-col gap-2 p-2">
				<Card padding="md">
					<p className="body-md text-secondary">Maximum possible exposure to {tokenSymbol}</p>
					<p className="mt-1 font-jetbrains text-2xl font-semibold text-primary">
						{formatRiskUsd(totalMaxExposureUsd)}
					</p>
					<p className="mt-1 body-md text-secondary">
						{formatRiskUsd(exposures.summary.totalCurrentMaxBorrowUsd)} (max additional borrows against {tokenSymbol})
						{exposures.summary.totalMinBadDebtAtPriceZeroUsd == null ? null : (
							<>
								{' '}
								+ {formatRiskUsd(exposures.summary.totalMinBadDebtAtPriceZeroUsd)} (bad debt if {tokenSymbol} was hacked
								now)
							</>
						)}
					</p>
				</Card>

				<Card padding="sm">
					<div className="space-y-3">
						{exposures.protocolSummaries.map((summary) => (
							<div
								key={summary.protocol}
								className="flex flex-col gap-2 border-b border-subtle pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<TokenLogo
											name={summary.protocolDisplayName}
											kind="token"
											size={18}
											alt={`Logo of ${summary.protocolDisplayName}`}
											title={summary.protocol}
										/>
										<p className="label-md text-primary">{summary.protocolDisplayName}</p>
									</div>
									<p className="mt-1 body-md text-secondary">
										<ProtocolExposureSummaryText summary={summary} tokenSymbol={tokenSymbol} />
									</p>
									<div className="mt-1">
										<ProtocolChainsLabel chainBreakdowns={summary.chainBreakdowns} />
									</div>
								</div>
							</div>
						))}
					</div>
				</Card>

				<Card as="details" padding="sm" className="group">
					<summary className="-m-2 flex cursor-pointer list-none items-center justify-between gap-3 p-2 label-md">
						<span>Methodology and limitations</span>
						<Icon
							name="chevron-down"
							height={16}
							width={16}
							className="shrink-0 text-tertiary transition-transform duration-200 group-open:rotate-180"
						/>
					</summary>
					<p className="mt-2 body-md">
						Showing collateral exposure for {tokenSymbol} on{' '}
						<span className="font-medium">{selectedCandidateDisplayName}</span>.{' '}
						<span className="font-medium">Max Borrowable</span> uses the backend&apos;s liquidity-bounded
						borrow-capacity metric (`collateralMaxBorrowUsdLiquidity`) for the maximum additional USD debt that can be
						issued against the asset right now. <span className="font-medium">Bad Debt at $0</span> is the minimum known
						bad debt if the collateral asset price goes to zero; null rows are excluded from this total rather than
						treated as zero, so totals may remain lower bounds.
					</p>
					<ul className="mt-3 list-disc space-y-1 pl-5 body-md">
						{riskData.limitations.map((limitation) => (
							<li key={limitation}>{limitation}</li>
						))}
					</ul>
				</Card>

				<Card as="details" padding="sm" className="group">
					<summary className="-m-2 flex cursor-pointer list-none items-center justify-between gap-3 p-2 label-md">
						<span>Show exposure details</span>
						<Icon
							name="chevron-down"
							height={16}
							width={16}
							className="shrink-0 text-tertiary transition-transform duration-200 group-open:rotate-180"
						/>
					</summary>
					<p className="mt-2 body-md">
						Each row is one protocol-chain exposure for {tokenSymbol} as collateral. Bad debt at $0 totals remain lower
						bounds when a row is marked partial.
					</p>
					<Suspense fallback={<div className="min-h-[360px]" />}>
						<DeferredPaginatedTable
							table={exposureTable}
							pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
							className="mt-3"
							shell="none"
						/>
					</Suspense>
				</Card>
			</div>
		</Panel>
	)
}
