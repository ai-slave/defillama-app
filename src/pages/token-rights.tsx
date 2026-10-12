import { createColumnHelper, type SortingState, useTable } from '@tanstack/react-table'
import { matchSorter } from 'match-sorter'
import { startTransition, useDeferredValue, useMemo, useState } from 'react'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { displayTableFeatures } from '~/components/Table/features/display'
import { Table } from '~/components/Table/Table'
import type { AdapterChainProtocol } from '~/containers/AdapterMetrics/api.types'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { TOKEN_RIGHTS_SECTION_ID } from '~/containers/Token/types'
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import {
	equityCaptureBadgeStatus,
	feeSwitchBadgeStatus,
	TokenRightsTagList
} from '~/containers/TokenRights/TokenRightsChips'
import Layout from '~/layout'
import { Button } from '~/ui/Button'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
import { Panel } from '~/ui/Panel'
import { SearchField } from '~/ui/SearchField'
import { StatusBadge } from '~/ui/StatusBadge'
import { InlineStatStrip } from '~/ui/SummaryStats'
import { TextLink } from '~/ui/TextLink'
import { TableToolbar } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { formatMonthYear } from '~/utils/dateFormat'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import type { ICexItem, IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'
import { formatUsd } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'
import { flushTelemetry, recordDomainEvent } from '~/utils/telemetry'
import {
	findTokenDirectoryRecordByDefillamaId,
	findTokenDirectoryRecordByGeckoId,
	type TokenDirectory
} from '~/utils/tokenDirectory'

interface TokenRightsListItem {
	name: string
	logo: string
	href: string | null
	deprecated?: boolean
	tokens: Array<string>
	holdersRevenue24h: number | null
	governanceRights: [boolean, boolean, boolean]
	economicRights: [boolean, boolean, boolean]
	feeSwitchStatus: TokenRightsFeeSwitchStatus
	feeSwitchDetails: string | null
	valueAccrual: string | null
	valueAccrualDetails: string | null
	equityRevenueCapture: string | null
	equityRevenueCaptureDetails: string | null
	lastUpdated: string | null
	hasBuybacks: boolean
	hasDividends: boolean
	hasBurns: boolean
	hasEquityCapture: boolean
	hasNoEquityCapture: boolean
}

type TokenRightsFeeSwitchStatus = 'ON' | 'OFF' | 'PENDING' | 'UNKNOWN'

type TokenRightsFilter =
	| 'feeSwitchOn'
	| 'hasBuybacks'
	| 'hasDividends'
	| 'hasBurns'
	| 'noEquityCapture'
	| 'equityCapture'

type TokenRightsMetadataMatch =
	| { source: 'chain'; metadata: IChainMetadata }
	| { source: 'protocol'; metadata: IProtocolMetadata }
	| { source: 'cex'; metadata: ICexItem }

type SkippedTokenRightsEntry = {
	defillamaId: string | null
	reason: 'missing_defillama_id' | 'missing_metadata' | 'missing_display_name'
	metadataSource?: TokenRightsMetadataMatch['source']
}

type TokenRightsLinkResolution =
	| { type: 'linked'; item: TokenRightsListItem }
	| { type: 'skipped'; entry: SkippedTokenRightsEntry }

const columnHelper = createColumnHelper<typeof displayTableFeatures, TokenRightsListItem>()

const TOKEN_RIGHTS_PILL_TOOLTIPS = {
	feeSwitch:
		'Whether the protocol has activated a mechanism to direct a share of fees to token holders through buybacks, revenue sharing or token burns. Status can be ON, OFF or PENDING.',
	valueAccrual: 'The main mechanism by which value accrues to token holders',
	equityRevenueCapture:
		'Whether any equity entity (Labs, parent company) captures protocol revenue separately from token holders. Active means equity holders receive revenue that could otherwise flow to token holders.'
} as const

const TOKEN_RIGHTS_FILTERS: Array<{ key: TokenRightsFilter; label: string }> = [
	{ key: 'feeSwitchOn', label: 'Fee Switch ON' },
	{ key: 'hasBuybacks', label: 'Has Buybacks' },
	{ key: 'hasDividends', label: 'Has Dividends' },
	{ key: 'hasBurns', label: 'Has Burns' },
	{ key: 'noEquityCapture', label: 'No Equity Capture' },
	{ key: 'equityCapture', label: 'Equity Capture' }
]

const DEFAULT_TOKEN_RIGHTS_SORTING: SortingState = [{ id: 'holdersRevenue24h', desc: true }]

export const getStaticProps = withPerformanceLogging('token-rights', async () => {
	const [entries, metadataModule, holdersRevenueResult] = await Promise.all([
		import('~/containers/TokenRights/server/dataset.server').then((mod) => mod.fetchTokenRightsEntries()),
		import('~/utils/metadata'),
		import('~/containers/AdapterMetrics/api')
			.then((m) =>
				m.fetchAdapterChainMetrics({
					adapterType: ADAPTER_TYPES.FEES,
					chain: 'All',
					dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE
				})
			)
			.then(
				(data) => ({ status: 'available' as const, data }),
				() => ({ status: 'unavailable' as const })
			)
	])

	const { chainMetadata, protocolMetadata, tokenDirectory, cexs } = metadataModule.default as {
		chainMetadata: Record<string, IChainMetadata>
		protocolMetadata: Record<string, IProtocolMetadata>
		tokenDirectory: TokenDirectory
		cexs: Array<ICexItem>
	}
	const holdersRevenueAvailable = holdersRevenueResult.status === 'available'
	const holdersRevenueByDefillamaId = holdersRevenueAvailable
		? buildHoldersRevenueByDefillamaId(holdersRevenueResult.data.protocols)
		: {}

	const protocols: Array<TokenRightsListItem> = []
	const skippedEntries: Array<SkippedTokenRightsEntry> = []

	for (const entry of entries) {
		const resolved = resolveTokenRightsListItem(entry, {
			chainMetadata,
			protocolMetadata,
			tokenDirectory,
			cexs,
			holdersRevenueByDefillamaId
		})

		if (resolved.type === 'linked') {
			protocols.push(resolved.item)
		} else {
			skippedEntries.push(resolved.entry)
		}
	}

	if (holdersRevenueAvailable) {
		protocols.sort((a, b) => (b.holdersRevenue24h ?? -1) - (a.holdersRevenue24h ?? -1))
	}
	reportSkippedTokenRightsEntries(skippedEntries)
	if (skippedEntries.length > 0) {
		await flushTelemetry({ timeoutMs: 2000, runtime: 'build' })
	}

	return {
		props: { protocols, holdersRevenueAvailable },
		revalidate: maxAgeForNext([22])
	}
})

function resolveTokenRightsListItem(
	entry: IRawTokenRightsEntry,
	{
		chainMetadata,
		protocolMetadata,
		tokenDirectory,
		cexs,
		holdersRevenueByDefillamaId
	}: {
		chainMetadata: Record<string, IChainMetadata>
		protocolMetadata: Record<string, IProtocolMetadata>
		tokenDirectory: TokenDirectory
		cexs: Array<ICexItem>
		holdersRevenueByDefillamaId: Record<string, number>
	}
): TokenRightsLinkResolution {
	const defillamaId = entry['DefiLlama ID']?.trim() || null
	const protocolName = entry['Protocol Name'].trim()
	const baseSkippedEntry = { defillamaId }

	if (!defillamaId) {
		return { type: 'skipped', entry: { ...baseSkippedEntry, reason: 'missing_defillama_id' } }
	}

	const metadataMatch = findTokenRightsMetadata(defillamaId, protocolName, chainMetadata, protocolMetadata, cexs)
	if (!metadataMatch) {
		return { type: 'skipped', entry: { ...baseSkippedEntry, reason: 'missing_metadata' } }
	}

	const name = getMetadataDisplayName(metadataMatch)
	if (!name) {
		return {
			type: 'skipped',
			entry: {
				...baseSkippedEntry,
				reason: 'missing_display_name',
				metadataSource: metadataMatch.source
			}
		}
	}

	const geckoId = metadataMatch.source === 'cex' ? metadataMatch.metadata.cgId : metadataMatch.metadata.gecko_id
	let tokenRecord = findTokenDirectoryRecordByDefillamaId(tokenDirectory, defillamaId)

	if (!tokenRecord && metadataMatch.source === 'cex') {
		const cexSlug = slug(protocolName)

		for (const key in tokenDirectory) {
			const token = tokenDirectory[key]
			if (token === undefined) continue

			if (slug(token.name) === cexSlug) {
				tokenRecord = token
				break
			}
		}
	}

	if (!tokenRecord) {
		tokenRecord = findTokenDirectoryRecordByGeckoId(tokenDirectory, geckoId)
	}
	const deprecated = metadataMatch.source !== 'cex' && metadataMatch.metadata.deprecated === true

	if (!tokenRecord) {
		return {
			type: 'linked',
			item: buildTokenRightsListItem({
				entry,
				name,
				href: null,
				holdersRevenueByDefillamaId,
				deprecated
			})
		}
	}

	return {
		type: 'linked',
		item: buildTokenRightsListItem({
			entry,
			name,
			logo: tokenRecord.logo ?? tokenIconUrl(name),
			href: tokenRecord.route ? `${tokenRecord.route}#${TOKEN_RIGHTS_SECTION_ID}` : null,
			holdersRevenueByDefillamaId,
			deprecated
		})
	}
}

function buildTokenRightsListItem({
	entry,
	name,
	logo,
	href,
	holdersRevenueByDefillamaId,
	deprecated
}: {
	entry: IRawTokenRightsEntry
	name: string
	logo?: string
	href: string | null
	holdersRevenueByDefillamaId: Record<string, number>
	deprecated?: boolean
}): TokenRightsListItem {
	const hasBuybacks = hasActiveTokens(entry.Buybacks)
	const hasDividends = hasActiveTokens(entry.Dividends)
	const hasBurns = isActiveText(entry.Burns)
	const equityRevenueCapture = trimToNull(entry['Equity Revenue Capture'])

	return {
		name,
		logo: logo ?? tokenIconUrl(name),
		href,
		...(deprecated ? { deprecated: true } : {}),
		tokens: entry.Token ?? [],
		holdersRevenue24h: holdersRevenueByDefillamaId[entry['DefiLlama ID']] ?? null,
		governanceRights: [
			hasActiveTokens(entry['Governance Decisions']),
			hasActiveTokens(entry['Treasury Decisions']),
			hasActiveTokens(entry['Revenue Decisions'])
		],
		economicRights: [hasBuybacks, hasDividends, hasBurns],
		feeSwitchStatus: toFeeSwitchStatus(entry['Fee Switch Status']),
		feeSwitchDetails: trimToNull(entry['Fee Switch Details']),
		valueAccrual: trimToNull(entry['Value Accrual']),
		valueAccrualDetails: trimToNull(entry['Value Accrual Details']),
		equityRevenueCapture,
		equityRevenueCaptureDetails: trimToNull(entry['Equity Statement']),
		lastUpdated: trimToNull(entry['Last Updated']),
		hasBuybacks,
		hasDividends,
		hasBurns,
		hasEquityCapture: equityRevenueCapture === 'Yes' || equityRevenueCapture === 'Partial',
		hasNoEquityCapture: equityRevenueCapture === 'No'
	}
}

function buildHoldersRevenueByDefillamaId(
	holdersRevenueProtocols: Array<Pick<AdapterChainProtocol, 'defillamaId' | 'parentProtocol' | 'total24h'>>
): Record<string, number> {
	const holdersRevenueByDefillamaId: Record<string, number> = {}
	const holdersRevenueByParentId: Record<string, number> = {}

	for (const protocol of holdersRevenueProtocols) {
		if (protocol.total24h == null) continue

		holdersRevenueByDefillamaId[protocol.defillamaId] = protocol.total24h

		if (protocol.parentProtocol) {
			holdersRevenueByParentId[protocol.parentProtocol] =
				(holdersRevenueByParentId[protocol.parentProtocol] ?? 0) + protocol.total24h
		}
	}

	for (const parentId in holdersRevenueByParentId) {
		const parentRevenue = holdersRevenueByParentId[parentId]
		if (parentRevenue !== undefined && holdersRevenueByDefillamaId[parentId] === undefined) {
			holdersRevenueByDefillamaId[parentId] = parentRevenue
		}
	}

	return holdersRevenueByDefillamaId
}

function trimToNull(value: string | undefined | null): string | null {
	const trimmed = value?.trim()
	return trimmed ? trimmed : null
}

function isInactiveValue(value: string): boolean {
	const normalized = value.trim().toLowerCase()
	return (
		normalized === '' ||
		normalized === 'n/a' ||
		normalized === 'na' ||
		normalized === 'none' ||
		normalized === 'unknown'
	)
}

function hasActiveTokens(tokens: Array<string> | undefined | null): boolean {
	if (!tokens || tokens.length === 0) return false

	for (const token of tokens) {
		if (!isInactiveValue(token)) return true
	}

	return false
}

function isActiveText(value: string | undefined | null): boolean {
	return value ? !isInactiveValue(value) : false
}

function toFeeSwitchStatus(value: string | undefined | null): TokenRightsFeeSwitchStatus {
	const normalized = value?.trim().toUpperCase()
	if (normalized === 'ON' || normalized === 'OFF' || normalized === 'PENDING') return normalized
	return 'UNKNOWN'
}

function findTokenRightsMetadata(
	defillamaId: string,
	name: string,
	chainMetadata: Record<string, IChainMetadata>,
	protocolMetadata: Record<string, IProtocolMetadata>,
	cexs: Array<ICexItem>
): TokenRightsMetadataMatch | null {
	const chain = chainMetadata[defillamaId]
	if (chain) return { source: 'chain', metadata: chain }

	for (const key in chainMetadata) {
		const cachedChain = chainMetadata[key]
		if (cachedChain === undefined) continue
		if (cachedChain.id === defillamaId) return { source: 'chain', metadata: cachedChain }
	}

	const protocol = protocolMetadata[defillamaId]
	if (protocol) return { source: 'protocol', metadata: protocol }

	const cexSlug = slug(name)
	for (const cex of cexs) {
		if (cex.slug && slug(cex.slug) === cexSlug) return { source: 'cex', metadata: cex }
	}

	return null
}

function getMetadataDisplayName(metadataMatch: TokenRightsMetadataMatch): string | null {
	if (metadataMatch.source === 'chain') {
		const chain = metadataMatch.metadata as IChainMetadata & { displayName?: string }
		return chain.displayName ?? chain.name ?? null
	}

	if (metadataMatch.source === 'protocol') {
		return metadataMatch.metadata.displayName ?? metadataMatch.metadata.name ?? null
	}

	return metadataMatch.metadata.name ?? null
}

function reportSkippedTokenRightsEntries(skippedEntries: Array<SkippedTokenRightsEntry>): void {
	if (skippedEntries.length === 0) return

	recordDomainEvent(
		'token_rights.alert',
		'warn',
		'token-rights',
		'Skipped token rights entries while building token-rights page',
		{
			skipped_count: skippedEntries.length,
			reason_counts: countSkippedTokenRightsReasons(skippedEntries),
			skipped_entries: skippedEntries
		}
	)
}

function countSkippedTokenRightsReasons(skippedEntries: Array<SkippedTokenRightsEntry>): Record<string, number> {
	const counts: Record<string, number> = {}
	for (const entry of skippedEntries) {
		counts[entry.reason] = (counts[entry.reason] ?? 0) + 1
	}
	return counts
}

function TokenRightsPage({
	protocols,
	holdersRevenueAvailable
}: {
	protocols: Array<TokenRightsListItem>
	holdersRevenueAvailable: boolean
}) {
	const [activeFilters, setActiveFilters] = useState<Array<TokenRightsFilter>>([])
	const [searchValue, setSearchValue] = useState('')
	const [sorting, setSorting] = useState<SortingState>(holdersRevenueAvailable ? DEFAULT_TOKEN_RIGHTS_SORTING : [])
	const deferredSearchValue = useDeferredValue(searchValue)
	const seoDescription = `Compare governance, economic, and ownership rights across ${protocols.length} DeFi protocols`

	const filteredProtocols = useMemo(
		() => filterTokenRightsRows(protocols, activeFilters, deferredSearchValue),
		[protocols, activeFilters, deferredSearchValue]
	)
	const stats = useMemo(() => getTokenRightsStats(filteredProtocols), [filteredProtocols])
	const latestUpdated = useMemo(() => getLatestUpdatedMonth(protocols), [protocols])
	const table = useTable({
		features: displayTableFeatures,
		data: filteredProtocols,
		columns,
		state: { sorting, columnVisibility: { holdersRevenue24h: holdersRevenueAvailable } },
		defaultColumn: { sortUndefined: 'last' },
		enableSortingRemoval: true,
		onSortingChange: (updater) => startTransition(() => setSorting(updater))
	})

	const toggleFilter = (filter: TokenRightsFilter) => {
		startTransition(() => {
			setActiveFilters((prev) => (prev.includes(filter) ? prev.filter((item) => item !== filter) : [...prev, filter]))
		})
	}

	return (
		<Layout
			title="DeFi Token Rights by Project - DefiLlama"
			description={seoDescription}
			canonicalUrl="/token-rights"
			pageName={['Token Rights']}
		>
			<div className="flex flex-col gap-2">
				<InlineStatStrip
					items={[
						{ label: 'Protocols', value: filteredProtocols.length },
						{ label: 'Fee Switch ON', value: stats.feeSwitchOn },
						{ label: 'Active Buybacks', value: stats.buybacks },
						{ label: 'Dividends', value: stats.dividends }
					]}
				/>

				<Panel>
					<TableToolbar>
						<SearchField
							label="Search protocol"
							value={searchValue}
							onChange={setSearchValue}
							placeholder="Search protocol…"
							width="standalone"
						/>
						<ExternalLinkButton
							href="https://docs.google.com/forms/d/e/1FAIpQLSdV1cCKiwQzzSlUIkPbfVHrTLFYaiDFpTR1cvXmuDiakORfuQ/viewform"
							icon="plus"
						>
							List your tokens
						</ExternalLinkButton>
					</TableToolbar>
					<div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
						<span className="mr-1 label-sm text-secondary">Filters</span>
						{TOKEN_RIGHTS_FILTERS.map((filter) => {
							const active = activeFilters.includes(filter.key)
							return (
								<Button
									key={filter.key}
									type="button"
									onClick={() => toggleFilter(filter.key)}
									variant="toggle"
									size="md"
									data-active={active}
									aria-pressed={active}
								>
									<Icon name={active ? 'x' : 'plus'} className="size-3.5" aria-hidden="true" />
									{filter.label}
								</Button>
							)
						})}
					</div>

					<div className="overflow-hidden">
						<Table table={table} rowSize={58} />
					</div>

					<TokenRightsLegend />

					<footer className="flex flex-wrap items-center justify-between gap-2 border-t border-subtle p-2 body-sm text-tertiary">
						<span>
							{latestUpdated ? `Last updated: ${latestUpdated} - ` : null}
							{filteredProtocols.length} protocols shown
						</span>
					</footer>
				</Panel>
			</div>
		</Layout>
	)
}

export function filterTokenRightsRows(
	protocols: Array<TokenRightsListItem>,
	activeFilters: Array<TokenRightsFilter>,
	searchValue: string
): Array<TokenRightsListItem> {
	const normalizedSearch = searchValue.trim()
	const source = normalizedSearch
		? matchSorter(protocols, normalizedSearch, {
				keys: ['name', (protocol) => protocol.tokens],
				threshold: matchSorter.rankings.CONTAINS
			})
		: protocols
	const filtered: Array<TokenRightsListItem> = []

	for (const protocol of source) {
		let matchesFilters = true
		for (const filter of activeFilters) {
			if (
				(filter === 'feeSwitchOn' && protocol.feeSwitchStatus !== 'ON') ||
				(filter === 'hasBuybacks' && !protocol.hasBuybacks) ||
				(filter === 'hasDividends' && !protocol.hasDividends) ||
				(filter === 'hasBurns' && !protocol.hasBurns) ||
				(filter === 'noEquityCapture' && !protocol.hasNoEquityCapture) ||
				(filter === 'equityCapture' && !protocol.hasEquityCapture)
			) {
				matchesFilters = false
				break
			}
		}

		if (matchesFilters) filtered.push(protocol)
	}

	return filtered
}

export function getTokenRightsStats(protocols: Array<TokenRightsListItem>) {
	let feeSwitchOn = 0
	let buybacks = 0
	let dividends = 0

	for (const protocol of protocols) {
		if (protocol.feeSwitchStatus === 'ON') feeSwitchOn++
		if (protocol.hasBuybacks) buybacks++
		if (protocol.hasDividends) dividends++
	}

	return { feeSwitchOn, buybacks, dividends }
}

function getLatestUpdatedMonth(protocols: Array<TokenRightsListItem>): string | null {
	let latestTime = 0

	for (const protocol of protocols) {
		if (!protocol.lastUpdated) continue
		const time = new Date(protocol.lastUpdated).getTime()
		if (time > latestTime) latestTime = time
	}

	return latestTime ? formatMonthYear(latestTime, { input: 'milliseconds' }) : null
}

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Protocol',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const name = getValue()
			const href = row.original.href

			return (
				<span className="flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<Logo size={24} src={row.original.logo} data-lgonly alt={`Logo of ${name}`} />
					{href ? (
						<span className="flex items-center gap-1 overflow-hidden">
							<TextLink href={href} truncate>
								{name}
							</TextLink>
							{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
						</span>
					) : (
						<span className="flex items-center gap-1 overflow-hidden">
							<span className="min-w-0 truncate label-md text-primary">{name}</span>
							{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
						</span>
					)}
				</span>
			)
		},
		meta: { headerClassName: 'min-w-[min(220px,40vw)]' }
	}),
	columnHelper.accessor('tokens', {
		header: 'Token',
		enableSorting: false,
		cell: ({ getValue }) => <TokenRightsTagList items={getValue()} />,
		meta: { headerClassName: 'min-w-[280px]' }
	}),
	columnHelper.accessor((row) => row.holdersRevenue24h ?? undefined, {
		id: 'holdersRevenue24h',
		header: 'Holders Rev 24h',
		enableSorting: true,
		cell: ({ getValue }) => {
			const value = getValue()
			return value == null ? (
				<span className="text-tertiary">-</span>
			) : (
				formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
			)
		},
		meta: {
			align: 'end',
			headerHelperText: 'Revenue distributed to token holders over the last 24 hours'
		}
	}),
	columnHelper.accessor('governanceRights', {
		header: 'Governance',
		enableSorting: false,
		cell: ({ getValue }) => (
			<RightsDots rights={getValue()} labels={['Governance decisions', 'Treasury decisions', 'Revenue decisions']} />
		),
		meta: {
			align: 'center',
			headerHelperText: 'Dots show whether token holders have governance, treasury, and revenue decision rights'
		}
	}),
	columnHelper.accessor('economicRights', {
		header: 'Economic Rights',
		enableSorting: false,
		cell: ({ getValue }) => <RightsDots rights={getValue()} labels={['Buybacks', 'Dividends', 'Burns']} />,
		meta: {
			align: 'center',
			headerHelperText: 'Dots show whether the token has buybacks, dividends, and burns'
		}
	}),
	columnHelper.accessor('feeSwitchStatus', {
		header: 'Fee Switch',
		enableSorting: false,
		cell: ({ getValue, row }) => <FeeSwitchBadge status={getValue()} details={row.original.feeSwitchDetails} />,
		meta: {
			align: 'center',
			headerHelperText: 'Whether protocol fees are currently routed to token holders'
		}
	}),
	columnHelper.accessor('valueAccrual', {
		header: 'Value Accrual',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()
			return value && value !== 'N/A' ? (
				<StatusBadge
					status="good"
					tooltip={row.original.valueAccrualDetails ?? TOKEN_RIGHTS_PILL_TOOLTIPS.valueAccrual}
				>
					{value}
				</StatusBadge>
			) : (
				<span className="text-tertiary">-</span>
			)
		},
		meta: {
			headerClassName: 'min-w-[260px]',
			headerHelperText: 'Mechanism by which token holders may benefit economically, such as buybacks or revenue share'
		}
	}),
	columnHelper.accessor('equityRevenueCapture', {
		header: 'Equity Revenue Capture',
		enableSorting: false,
		cell: ({ getValue, row }) => (
			<EquityCaptureBadge value={getValue()} details={row.original.equityRevenueCaptureDetails} />
		),
		meta: {
			align: 'center',
			headerHelperText: 'Whether token holders have exposure to protocol or company revenue similar to equity'
		}
	})
])

function RightsDots({ rights, labels }: { rights: [boolean, boolean, boolean]; labels: [string, string, string] }) {
	const content = (
		<div className="flex flex-col gap-1">
			{rights.map((active, index) => (
				<span key={labels[index]} className="flex items-center gap-2">
					<span
						className={active ? 'size-2 rounded-full bg-success' : 'size-2 rounded-full border border-success-muted'}
					/>
					<span>
						{labels[index]}: {active ? 'Active' : 'Inactive'}
					</span>
				</span>
			))}
		</div>
	)

	return (
		<Hovercard
			className="gap-2"
			render={
				<button
					type="button"
					aria-label={labels.map((label, index) => `${label}: ${rights[index] ? 'Active' : 'Inactive'}`).join(', ')}
				/>
			}
			content={content}
		>
			{rights.map((active, index) => (
				<span
					key={labels[index]}
					className={active ? 'size-3 rounded-full bg-success' : 'size-3 rounded-full border-2 border-success-muted'}
				/>
			))}
		</Hovercard>
	)
}

function FeeSwitchBadge({ status, details }: { status: TokenRightsFeeSwitchStatus; details: string | null }) {
	if (status === 'UNKNOWN') return <span className="text-tertiary">-</span>
	return (
		<StatusBadge status={feeSwitchBadgeStatus(status)} tooltip={details ?? TOKEN_RIGHTS_PILL_TOOLTIPS.feeSwitch}>
			{status}
		</StatusBadge>
	)
}

function EquityCaptureBadge({ value, details }: { value: string | null; details: string | null }) {
	if (!value) return <span className="text-tertiary">-</span>
	return (
		<StatusBadge
			status={equityCaptureBadgeStatus(value)}
			tooltip={details ?? TOKEN_RIGHTS_PILL_TOOLTIPS.equityRevenueCapture}
		>
			{value}
		</StatusBadge>
	)
}

function TokenRightsLegend() {
	return (
		<div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-subtle px-3 py-2.5 body-sm text-secondary">
			<span className="mr-1 label-sm text-tertiary uppercase">Legend</span>
			<span className="inline-flex items-center gap-2">
				<span className="size-3 rounded-full bg-success" />
				Active
			</span>
			<span className="inline-flex items-center gap-2">
				<span className="size-3 rounded-full border-2 border-success-muted" />
				Inactive
			</span>
			<span className="inline-flex items-center gap-2">
				<StatusBadge status="good">ON</StatusBadge>
				Fee Switch ON
			</span>
			<span className="inline-flex items-center gap-2">
				<StatusBadge status="bad">OFF</StatusBadge>
				Fee Switch OFF
			</span>
			<span className="inline-flex items-center gap-2">
				<StatusBadge status="caution">PENDING</StatusBadge>
				Fee Switch Pending
			</span>
		</div>
	)
}

export default TokenRightsPage
