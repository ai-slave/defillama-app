import { useRouter } from 'next/router'
import { lazy, Suspense } from 'react'
import { useGetTokenPrice } from '~/api/client'
import { Bookmark } from '~/components/Bookmark'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { BasicLink } from '~/components/Link'
import { LinkPreviewCard } from '~/components/SEO'
import { TokenLogo } from '~/components/TokenLogo'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { EntityTitleRow } from '~/ui/EntityTitleRow'
import { HeroMetric } from '~/ui/HeroMetric'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { slug } from '~/utils'
import { tokenIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import { AdditionalInfo } from './AdditionalInfo'
import { formatProtocolSummaryValue, resolveProtocolChartDenomination } from './chartQuery'
import { getPrimaryValueLabelType, useFinalTVL } from './helpers'
import { InviteBanner } from './InviteBanner'
import { KeyMetrics } from './KeyMetrics'
import { ProtocolOverviewLayout } from './Layout'
import { getProtocolPrimaryMetricOverride } from './primaryMetricOverrides'
import { ProtocolChartPanel } from './ProtocolChartPanel'
import { ProtocolFaq } from './ProtocolFaq'
import type { IProtocolOverviewPageData } from './types'

const IncomeStatement = lazy(() => import('./IncomeStatement').then((module) => ({ default: module.IncomeStatement })))

export function ProtocolOverview(props: IProtocolOverviewPageData) {
	const router = useRouter()

	const { tvl, tvlByChain, oracleTvs, oracleTvsByChain, toggleOptions } = useFinalTVL(props)
	const hasTvlData = props.currentTvlByChain !== null
	const selectedDenomination = resolveProtocolChartDenomination(router.query.denomination, props.chartDenominations)

	const { data: chainPrice, isLoading: fetchingChainPrice } = useGetTokenPrice(
		props.chartDenominations[1]?.geckoId ?? undefined
	)

	const formatPrice = (value: number | null): string | number | null =>
		formatProtocolSummaryValue(value, {
			selectedDenomination,
			tokenSymbol: props.chartDenominations[1]?.symbol,
			tokenPrice: fetchingChainPrice ? null : chainPrice
		})
	const linkPreviewMetric = props.isOracleProtocol ? oracleTvs : hasTvlData ? tvl : null
	const linkPreviewTvl =
		linkPreviewMetric == null
			? undefined
			: formatUsd(linkPreviewMetric, {
					compact: true,
					minimumCompactValue: 1_000_000,
					compactSuffix: 'lowercase'
				})?.toString()

	return (
		<ProtocolOverviewLayout
			{...(props.isCEX !== undefined ? { isCEX: props.isCEX } : {})}
			name={props.name}
			{...(props.category !== undefined ? { category: props.category } : {})}
			{...(props.otherProtocols !== undefined ? { otherProtocols: props.otherProtocols } : {})}
			toggleOptions={toggleOptions}
			metrics={props.metrics}
			{...(props.warningBanners !== undefined ? { warningBanners: props.warningBanners } : {})}
			tab="information"
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
			{...(props.entityQuestions !== undefined ? { entityQuestions: props.entityQuestions } : {})}
		>
			<LinkPreviewCard
				cardName={props.name}
				token={props.name}
				logo={tokenIconUrl(props.name)}
				{...(linkPreviewTvl !== undefined ? { tvl: linkPreviewTvl } : {})}
				{...(props.isOracleProtocol ? { valueHeader: 'Total Value Secured' } : {})}
				{...(props.isCEX !== undefined ? { isCEX: props.isCEX } : {})}
			/>
			{props.hasInviteCodes ? (
				<InviteBanner key={props.name} protocol={slug(props.name)} name={props.name} website={props.website} />
			) : null}
			<SummaryCardGrid>
				<SummaryStatsCard padding="sm" className="xl:min-h-[360px]">
					<ProtocolHeader
						props={props}
						hasTvlData={hasTvlData}
						oracleTvs={oracleTvs}
						tvl={tvl}
						tvlByChain={tvlByChain}
						oracleTvsByChain={oracleTvsByChain}
						formatPrice={formatPrice}
						headingAs="h1"
					/>
					<KeyMetrics
						{...props}
						formatPrice={formatPrice}
						tvl={tvl}
						tvlByChain={tvlByChain}
						computedOracleTvs={oracleTvs}
						hasTvlData={hasTvlData}
					/>
				</SummaryStatsCard>
				<div className="col-span-2 flex flex-col">
					<Suspense
						fallback={
							<ChartPanel>
								<ChartPanelExportShellFallback />
							</ChartPanel>
						}
					>
						<ProtocolChartPanel {...props} />
					</Suspense>
				</div>
				<AdditionalInfo {...props} />
				{props.incomeStatement ? (
					<Suspense fallback={null}>
						<IncomeStatement
							name={props.name}
							incomeStatement={props.incomeStatement}
							hasIncentives={props.metrics.incentives}
						/>
					</Suspense>
				) : null}
			</SummaryCardGrid>
			{props.faqItems?.length ? <ProtocolFaq items={props.faqItems} /> : null}
		</ProtocolOverviewLayout>
	)
}

function ProtocolHeader({
	props,
	hasTvlData,
	oracleTvs,
	tvl,
	tvlByChain,
	oracleTvsByChain,
	formatPrice,
	headingAs: Tag = 'h1'
}: {
	props: IProtocolOverviewPageData
	hasTvlData: boolean
	oracleTvs: number | null
	tvl: number
	tvlByChain: Array<[string, number]>
	oracleTvsByChain: Array<[string, number]>
	formatPrice: (value: number | null) => string | number | null
	headingAs?: 'h1' | 'div'
}) {
	const primaryMetricOverride = getProtocolPrimaryMetricOverride(props)

	return (
		<>
			<EntityTitleRow
				as={Tag}
				logo={<TokenLogo name={props.name} kind="token" size={24} alt={`Logo of ${props.name}`} />}
				actions={
					<>
						{props.website ? (
							<WebsiteGlobeLink
								url={props.website}
								name={props.name}
								event="protocol-website-click"
								eventData={{ protocol: props.name, referral: String(!!props.isWebsiteReferral) }}
							/>
						) : null}
						<Bookmark size="md" readableName={props.name} />
					</>
				}
			>
				{props.name}
				{props.token?.symbol && props.token.symbol !== '-' ? (
					<span className="font-normal">({props.token.symbol})</span>
				) : null}
				{props.deprecated ? <DeprecatedProtocolMarker size="size-4.5" /> : null}
			</EntityTitleRow>
			{props.exchangeProfileRoute ? (
				// Sits directly under the title, like the token page's issuer line: this protocol
				// is a tracked venue, and its markets, liquidity and execution live on that page.
				<BasicLink href={props.exchangeProfileRoute} className="-mt-4 w-fit label-md text-link hover:underline">
					View exchange stats
				</BasicLink>
			) : null}
			{primaryMetricOverride ? (
				<PrimaryValue
					hasTvl
					value={primaryMetricOverride.value}
					name={props.name}
					category={props.category}
					valueByChain={primaryMetricOverride.valueByChain}
					formatPrice={formatPrice}
					title={primaryMetricOverride.title}
					byChainTitle={primaryMetricOverride.byChainTitle}
				/>
			) : props.isOracleProtocol ? (
				<PrimaryValue
					hasTvl
					value={oracleTvs}
					name={props.name}
					category="Oracle"
					valueByChain={oracleTvsByChain}
					formatPrice={formatPrice}
				/>
			) : (
				<PrimaryValue
					hasTvl={hasTvlData}
					value={tvl}
					name={props.name}
					category={props.category === 'Oracle' ? null : props.category}
					valueByChain={tvlByChain}
					formatPrice={formatPrice}
				/>
			)}
		</>
	)
}

function PrimaryValue({
	hasTvl,
	value,
	name,
	category,
	formatPrice,
	valueByChain,
	title: titleOverride,
	byChainTitle: byChainTitleOverride
}: {
	hasTvl: boolean
	value: number | null
	name: string
	category: string | null | undefined
	formatPrice: (value: number | null) => string | number | null
	valueByChain?: Array<[string, number]>
	title?: string
	byChainTitle?: string
}) {
	if (!hasTvl) return null

	const defaultLabels = getPrimaryValueLabelType(category)
	return (
		<HeroMetric
			label={titleOverride ?? defaultLabels.title}
			value={formatPrice(value) ?? 'N/A'}
			byChainTitle={byChainTitleOverride ?? defaultLabels.byChainTitle}
			{...(valueByChain ? { byChain: valueByChain.map(([chain, tvl]) => [chain, formatPrice(tvl)]) } : {})}
		/>
	)
}
