import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import type { ReactNode } from 'react'
import { getTokenIncomeStatement } from '~/containers/ProtocolOverview/queries'
import {
	buildInitialBorrowRoutesSnapshot,
	buildInitialYieldsSnapshot,
	downgradeTokenPageDataError,
	getCoinGeckoId,
	getTokenPageSections,
	getTokenRiskData
} from '~/containers/Token/queries'
import { TokenBorrowSection } from '~/containers/Token/TokenBorrowSection'
import { TokenIncomeStatementSection } from '~/containers/Token/TokenIncomeStatementSection'
import { TokenLiquidationsSection } from '~/containers/Token/TokenLiquidationsSection'
import { TokenMarketsSection } from '~/containers/Token/TokenMarketsSection'
import { getTokenOverviewData, TOKEN_OVERVIEW_DEFAULT_CHARTS } from '~/containers/Token/tokenOverview'
import { TokenOverviewSection } from '~/containers/Token/TokenOverviewSection'
import { TokenPageSectionNav } from '~/containers/Token/TokenPageSectionNav'
import { TokenRisksSection } from '~/containers/Token/TokenRisksSection'
import { resolveTokenUnlockSlug } from '~/containers/Token/tokenUnlocks'
import { TokenUnlocksSection } from '~/containers/Token/TokenUnlocksSection'
import { TokenUsageSection } from '~/containers/Token/TokenUsageSection'
import { TokenYieldsSection } from '~/containers/Token/TokenYieldsSection'
import type { TokenPageProps, TokenPageSection } from '~/containers/Token/types'
import { TokenRightsByProtocol } from '~/containers/TokenRights/TokenRightsByProtocol'
import { parseTokenRightsEntry } from '~/containers/TokenRights/utils'
import { getTokensCacheControl } from '~/containers/Tokens/cache.server'
import { getTokenOverviewCurrentSnapshot } from '~/containers/Tokens/queries.server'
import Layout from '~/layout'
import { slug } from '~/utils'
import { normalizeLiquidationsTokenSymbol } from '~/utils/metadata/liquidations'
import type { ITokenListEntry } from '~/utils/metadata/types'
import { canonicalRouteRedirect, safeDecodeURIComponent } from '~/utils/route'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'
import {
	getCanonicalTokenRoute,
	type TokenDirectory,
	type TokenDirectoryRecord,
	type TokenDirectoryRecordByRouteSegment
} from '~/utils/tokenDirectory'

function getTokenDirectoryRecordForRouteParam(
	tokenDirectory: TokenDirectory,
	tokenDirectoryRecordByRouteSegment: TokenDirectoryRecordByRouteSegment,
	tokenParam: string
): TokenDirectoryRecord | null {
	const normalizedToken = slug(tokenParam)
	const directRecord = tokenDirectory[normalizedToken]
	if (directRecord) return directRecord

	return tokenDirectoryRecordByRouteSegment[safeDecodeURIComponent(tokenParam)] ?? null
}

function tokenRouteMatchesParam(canonicalUrl: string, tokenParam: string): boolean {
	const routePrefix = '/token/'
	if (!canonicalUrl.startsWith(routePrefix)) return false

	const canonicalToken = canonicalUrl.slice(routePrefix.length)
	return safeDecodeURIComponent(canonicalToken) === safeDecodeURIComponent(tokenParam)
}

type TokenPageSectionRendererMap = {
	[Section in TokenPageSection as Section['id']]: (props: { section: Section }) => ReactNode
}

const getServerSidePropsHandler: GetServerSideProps<TokenPageProps> = async ({ params, res }) => {
	const token = params?.token
	if (typeof token !== 'string') {
		res.setHeader('Cache-Control', 'private, no-store')
		return { notFound: true }
	}

	const metadataModule = await import('~/utils/metadata')
	const metadataCache = metadataModule.default
	const normalizedToken = slug(token)
	const record = getTokenDirectoryRecordForRouteParam(
		metadataCache.tokenDirectory,
		metadataCache.tokenDirectoryRecordByRouteSegment,
		token
	)

	if (!record) {
		res.setHeader('Cache-Control', 'private, no-store')
		return { notFound: true }
	}

	const geckoId = getCoinGeckoId(record.token_nk)
	const canonicalUrl = getCanonicalTokenRoute(record)
	if (!tokenRouteMatchesParam(canonicalUrl, token)) {
		res.setHeader('Cache-Control', 'private, no-store')
		return canonicalRouteRedirect(canonicalUrl)
	}

	const tokenEntry: ITokenListEntry | null = geckoId ? (metadataCache.tokenlist[geckoId] ?? null) : null
	const protocolMetadata = record.protocolId ? (metadataCache.protocolMetadata[record.protocolId] ?? null) : null
	const resolvedUnlocksSlug =
		resolveTokenUnlockSlug({
			record,
			protocolMetadata: metadataCache.protocolMetadata,
			chainMetadata: metadataCache.chainMetadata,
			emissionsProtocolsList: metadataCache.emissionsProtocolsList
		}) ?? null
	const llamaswapChains = geckoId ? (metadataCache.protocolLlamaswapDataset?.[geckoId] ?? null) : null
	const displayName = slug(record.symbol) === normalizedToken ? record.symbol : record.name
	const normalizedLiquidationsSymbol = normalizeLiquidationsTokenSymbol(record.symbol)
	const chainDefiLlamaId = record.chainId ? `chain#${record.chainId.toLowerCase()}` : null
	const protocolDefiLlamaId = record.protocolId ?? protocolMetadata?.name ?? null
	const currentSnapshotPromise = geckoId ? getTokenOverviewCurrentSnapshot(geckoId) : Promise.resolve(null)
	const [
		{ isDatasetSnapshotIntegrityError },
		{ hasTokenLiquidationsData },
		{ fetchLiquidityEntryByProtocolId },
		{ hasTokenMarkets },
		{ fetchRaisesByDefillamaId },
		{ getIndexedTokenRiskBorrowCapacity },
		{ fetchTokenRightsEntryByDefillamaId, fetchTokenRightsEntryByName },
		{ fetchTreasuryById },
		{ acquireOptionalYieldsSnapshot, readYieldsMeta },
		{ getTokenBorrowRoutes, getTokenEarnRows }
	] = await Promise.all([
		import('~/server/datasetSnapshots/errors'),
		import('~/containers/LiquidationsV2/server/dataset.server'),
		import('~/containers/Token/server/dataset.liquidity.server'),
		import('~/containers/Markets/server/dataset.server'),
		import('~/containers/Raises/server/dataset.server'),
		import('~/containers/Token/server/dataset.risk.server'),
		import('~/containers/TokenRights/server/dataset.server'),
		import('~/containers/Treasuries/server/dataset.server'),
		import('~/containers/Yields/server/dataset.server'),
		import('~/containers/Yields/data/server/tokenPage')
	])
	const yieldsDatasetSnapshot = await acquireOptionalYieldsSnapshot()
	const downgradeTokenPageError = <T,>(error: unknown, message: string, fallback: T): T =>
		downgradeTokenPageDataError(error, message, fallback, isDatasetSnapshotIntegrityError)
	const marketsAvailablePromise = geckoId
		? hasTokenMarkets(geckoId).catch((error) =>
				downgradeTokenPageError(error, `Failed to load token markets index for ${geckoId}`, false)
			)
		: Promise.resolve(false)
	let liquidationsPromise: Promise<boolean> = Promise.resolve(false)
	if (normalizedLiquidationsSymbol && metadataCache.liquidationsTokenSymbolsSet.has(normalizedLiquidationsSymbol)) {
		const liquidationsSymbol = normalizedLiquidationsSymbol
		liquidationsPromise = hasTokenLiquidationsData(liquidationsSymbol).catch((error) =>
			downgradeTokenPageError(error, `Failed to load token liquidations data for ${record.symbol}`, false)
		)
	}
	const overviewPromise = (async () => {
		const shouldFetchRaises = Boolean(chainDefiLlamaId || protocolDefiLlamaId)
		const shouldFetchTreasury = Boolean(!record.chainId && protocolDefiLlamaId)
		const shouldFetchLiquidity = Boolean(protocolMetadata?.liquidity && protocolDefiLlamaId)
		const [raises, treasury, yieldsMeta, liquidityInfo, currentSnapshot] = await Promise.all([
			shouldFetchRaises ? fetchRaisesByDefillamaId(chainDefiLlamaId ?? protocolDefiLlamaId!) : Promise.resolve(null),
			// Treasury shards are keyed by the upstream `${defillamaId}-treasury` convention.
			shouldFetchTreasury ? fetchTreasuryById(`${protocolDefiLlamaId}-treasury`) : Promise.resolve(null),
			shouldFetchLiquidity && yieldsDatasetSnapshot ? readYieldsMeta(yieldsDatasetSnapshot) : Promise.resolve(null),
			shouldFetchLiquidity ? fetchLiquidityEntryByProtocolId(protocolDefiLlamaId!) : Promise.resolve(null),
			currentSnapshotPromise
		])

		return getTokenOverviewData({
			record,
			displayName,
			geckoId,
			tokenEntry,
			protocolMetadata,
			cgExchangeIdentifiers: metadataCache.cgExchangeIdentifiers ?? [],
			llamaswapChains,
			emissionsSupplyMetrics: metadataCache.emissionsSupplyMetrics,
			currentMetrics: currentSnapshot?.metrics ?? null,
			source: {
				kind: 'prefetched',
				raises,
				treasury,
				yieldsMeta,
				liquidityInfo
			},
			prefetchedCharts: TOKEN_OVERVIEW_DEFAULT_CHARTS
		})
	})()

	const tokenRightsDefillamaIds = Array.from(
		new Set(
			[record.chainId, record.protocolId].filter(
				(defillamaId): defillamaId is string => typeof defillamaId === 'string' && defillamaId.length > 0
			)
		)
	)
	const tokenRightsPromise = record.tokenRights
		? (async () => {
				try {
					for (const defillamaId of tokenRightsDefillamaIds) {
						const rawEntry = await fetchTokenRightsEntryByDefillamaId(defillamaId)
						if (rawEntry) return parseTokenRightsEntry(rawEntry)
					}
					const rawEntry = tokenRightsDefillamaIds.length === 0 ? await fetchTokenRightsEntryByName(record.name) : null
					return rawEntry ? parseTokenRightsEntry(rawEntry) : null
				} catch (error) {
					return downgradeTokenPageError(
						error,
						`Failed to load token rights data for ${tokenRightsDefillamaIds.join(', ') || record.name}`,
						null
					)
				}
			})()
		: Promise.resolve(null)

	const incomeStatementPromise = record.incomeStatement
		? getTokenIncomeStatement({ token }).catch((error) => {
				console.error(`Failed to load income statement data for ${record.name}`, error)
				return null
			})
		: Promise.resolve(null)

	const tokenRiskPromise = geckoId
		? (async () => {
				return getTokenRiskData({
					geckoId,
					tokenSymbol: record.symbol,
					protocolLlamaswapDataset: metadataCache.protocolLlamaswapDataset,
					displayLookups: {
						protocolDisplayNames: metadataCache.protocolDisplayNames,
						chainDisplayNames: metadataCache.chainDisplayNames
					},
					borrowCapacitySnapshot: await getIndexedTokenRiskBorrowCapacity()
				})
			})().catch((error) => {
				return downgradeTokenPageError(error, `Failed to load token risk data for ${geckoId}`, null)
			})
		: Promise.resolve(null)

	const yieldsRowsPromise =
		record.is_yields && yieldsDatasetSnapshot
			? getTokenEarnRows(yieldsDatasetSnapshot, record.symbol).catch((error) =>
					downgradeTokenPageError(error, `Failed to load token yields data for ${record.symbol}`, {
						rows: [],
						tokenKeys: []
					})
				)
			: Promise.resolve({ rows: [], tokenKeys: [] })

	const borrowRoutesPromise = yieldsDatasetSnapshot
		? getTokenBorrowRoutes(yieldsDatasetSnapshot, record.symbol).catch((error) =>
				downgradeTokenPageError(error, `Failed to load token borrow routes data for ${record.symbol}`, null)
			)
		: Promise.resolve(null)

	const [
		overview,
		tokenRightsData,
		resolvedIncomeStatementData,
		yieldsData,
		tokenBorrowRoutesData,
		hasLiquidations,
		tokenRiskData,
		hasMarkets,
		currentSnapshot
	] = await Promise.all([
		overviewPromise,
		tokenRightsPromise,
		incomeStatementPromise,
		yieldsRowsPromise,
		borrowRoutesPromise,
		liquidationsPromise,
		tokenRiskPromise,
		marketsAvailablePromise,
		currentSnapshotPromise
	])

	const yieldsSnapshot = buildInitialYieldsSnapshot(yieldsData.rows, yieldsData.tokenKeys)
	const borrowRoutesSnapshot = buildInitialBorrowRoutesSnapshot(
		tokenBorrowRoutesData,
		tokenBorrowRoutesData?.tokenKeys ?? []
	)
	const issuerDisplayName = protocolMetadata?.displayName ?? protocolMetadata?.name ?? null
	const issuer =
		record.protocolId && issuerDisplayName ? { name: issuerDisplayName, slug: slug(issuerDisplayName) } : null
	const sections = getTokenPageSections({
		record,
		geckoId,
		tokenRightsData,
		incomeStatement: resolvedIncomeStatementData,
		tokenRiskData,
		hasLiquidations,
		hasMarkets,
		resolvedUnlocksSlug,
		yieldsSnapshot,
		borrowRoutesSnapshot,
		issuer,
		overview
	})

	const seoTitle = record.tokenRights
		? `${displayName} Price, Market Cap, Supply, Trading Volume & Token Rights`
		: `${displayName} Price, Market Cap, Supply & Trading Volume`
	const seoDescription = record.tokenRights
		? `Track ${displayName} price, market cap, circulating supply, max supply, trading volume, and token rights.`
		: `Track ${displayName} price, market cap, circulating supply, max supply, and trading volume.`

	res.setHeader('Cache-Control', getTokensCacheControl(currentSnapshot?.generatedAt ?? Date.now()))
	return {
		props: {
			seoTitle,
			seoDescription,
			canonicalUrl,
			sections
		}
	}
}

export const getServerSideProps = withServerSidePropsTelemetry('/token/[token]', getServerSidePropsHandler)

const TOKEN_SECTION_RENDERERS = {
	'token-overview': ({ section }) => (
		<TokenOverviewSection
			overview={section.overview}
			geckoId={section.geckoId}
			logo={section.logo}
			issuer={section.issuer}
		/>
	),
	'token-markets': ({ section }) => <TokenMarketsSection geckoId={section.geckoId} tokenSymbol={section.tokenSymbol} />,
	'token-income-statement': ({ section }) => (
		<TokenIncomeStatementSection tokenSymbol={section.tokenSymbol} incomeStatement={section.incomeStatement} />
	),
	'token-risks': ({ section }) => <TokenRisksSection tokenSymbol={section.tokenSymbol} riskData={section.riskData} />,
	'token-rights-and-value-accrual': ({ section }) => (
		<TokenRightsByProtocol
			name={section.name}
			symbol={section.symbol}
			tokenRightsData={section.tokenRightsData}
			raises={null}
			showHeader
			headerVariant="embedded"
		/>
	),
	'token-usage': ({ section }) => <TokenUsageSection tokenSymbol={section.tokenSymbol} />,
	'token-liquidations': ({ section }) => <TokenLiquidationsSection tokenSymbol={section.tokenSymbol} />,
	'token-unlocks': ({ section }) => <TokenUnlocksSection resolvedUnlocksSlug={section.resolvedUnlocksSlug} />,
	'token-yields': ({ section }) => <TokenYieldsSection hydration={section.hydration} />,
	'token-borrow': ({ section }) => (
		<TokenBorrowSection tokenSymbol={section.tokenSymbol} hydration={section.hydration} />
	)
} satisfies TokenPageSectionRendererMap

function TokenPageSectionRenderer<Section extends TokenPageSection>({ section }: { section: Section }) {
	const SectionRenderer = TOKEN_SECTION_RENDERERS[section.id] as (props: { section: Section }) => ReactNode
	return <SectionRenderer section={section} />
}

export default function TokenPage(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
	return (
		<Layout title={props.seoTitle} description={props.seoDescription} canonicalUrl={props.canonicalUrl}>
			<div className="flex flex-col gap-2">
				<TokenPageSectionNav
					sections={props.sections.map((section) => ({
						id: section.id,
						label: section.label
					}))}
				/>
				{props.sections.map((section) => (
					<TokenPageSectionRenderer key={`token-page-${section.id}`} section={section} />
				))}
			</div>
		</Layout>
	)
}
