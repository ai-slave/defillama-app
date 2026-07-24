import { useRouter } from 'next/router'
import { lazy, Suspense } from 'react'
import { useGetTokenPrice } from '~/api/client'
import { Bookmark } from '~/components/Bookmark'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { LinkPreviewCard } from '~/components/SEO'
import { TokenLogo } from '~/components/TokenLogo'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import { buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { tokenIconUrl } from '~/utils/icons'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import { AdditionalInfo } from './AdditionalInfo'
import { getPrimaryValueLabelType, useFinalTVL } from './helpers'
import { KeyMetrics } from './KeyMetrics'
import { ProtocolOverviewLayout } from './Layout'
import { getProtocolPrimaryMetricOverride } from './primaryMetricOverrides'
import { ProtocolChartPanel } from './ProtocolChartPanel'
import { ProtocolFaq } from './ProtocolFaq'
import type { IProtocolOverviewPageData } from './types'

const IncomeStatement = lazy(() => import('./IncomeStatement').then((module) => ({ default: module.IncomeStatement })))

export const ProtocolOverview = (props: IProtocolOverviewPageData) => {
	const router = useRouter()

	const { tvl, tvlByChain, oracleTvs, oracleTvsByChain, toggleOptions } = useFinalTVL(props)

	const { data: chainPrice, isLoading: fetchingChainPrice } = useGetTokenPrice(
		props.chartDenominations?.[1]?.geckoId ?? undefined
	)

	const formatPrice = (value?: number | string | null): string | number | null => {
		if (Number.isNaN(Number(value))) return null

		if (
			!fetchingChainPrice &&
			chainPrice?.price &&
			typeof router.query.denomination === 'string' &&
			props.chartDenominations?.[1]?.symbol &&
			props.chartDenominations[1].symbol === router.query.denomination
		) {
			return (
				formatCompactNumber(Number(value) / chainPrice.price, {
					minimumCompactValue: 1_000_000,
					compactSuffix: 'lowercase'
				}) + ` ${chainPrice.symbol}`
			)
		}

		return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
	}

	return (
		<ProtocolOverviewLayout
			isCEX={props.isCEX}
			name={props.name}
			category={props.category ?? ''}
			otherProtocols={props.otherProtocols ?? undefined}
			toggleOptions={toggleOptions}
			metrics={props.metrics}
			warningBanners={props.warningBanners}
			tab="information"
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
			entityQuestions={props.entityQuestions}
		>
			<LinkPreviewCard
				cardName={props.name}
				token={props.name}
				logo={tokenIconUrl(props.name)}
				tvl={formatUsd(tvl, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })?.toString()}
				isCEX={props.isCEX}
			/>
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<Card padding="sm" className="col-span-1 row-[2/3] hidden flex-col gap-6 xl:row-[1/2] xl:flex xl:min-h-[360px]">
					<ProtocolHeader
						props={props}
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
					/>
				</Card>
				<div className="col-span-1 grid grid-cols-2 gap-2 xl:col-[2/-1]">
					<div className="col-span-full flex flex-col gap-2">
						<Card padding="sm" className="flex flex-col gap-6 xl:hidden">
							<ProtocolHeader
								props={props}
								oracleTvs={oracleTvs}
								tvl={tvl}
								tvlByChain={tvlByChain}
								oracleTvsByChain={oracleTvsByChain}
								formatPrice={formatPrice}
								headingAs="div"
							/>
						</Card>
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
					{props.hasKeyMetrics ? (
						<Card padding="sm" className="col-span-full flex flex-col gap-6 xl:hidden">
							<KeyMetrics
								{...props}
								formatPrice={formatPrice}
								tvl={tvl}
								tvlByChain={tvlByChain}
								computedOracleTvs={oracleTvs}
							/>
						</Card>
					) : null}
				</div>
				<AdditionalInfo {...props} />
				{props.incomeStatement?.data ? (
					<Suspense fallback={<></>}>
						<IncomeStatement
							name={props.name}
							incomeStatement={props.incomeStatement}
							hasIncentives={props.metrics?.incentives}
						/>
					</Suspense>
				) : null}
			</div>
			{props.faqItems?.length ? <ProtocolFaq items={props.faqItems} /> : null}
		</ProtocolOverviewLayout>
	)
}

function ProtocolHeader({
	props,
	oracleTvs,
	tvl,
	tvlByChain,
	oracleTvsByChain,
	formatPrice,
	headingAs: Tag = 'h1'
}: {
	props: IProtocolOverviewPageData
	oracleTvs: number
	tvl: number
	tvlByChain: [string, number][]
	oracleTvsByChain: [string, number][]
	formatPrice: (value?: number | string | null) => string | number | null
	headingAs?: 'h1' | 'div'
}) {
	const primaryMetricOverride = getProtocolPrimaryMetricOverride(props)

	return (
		<>
			<Tag className="flex flex-wrap items-center gap-2 heading-sm">
				<TokenLogo name={props.name} kind="token" size={24} alt={`Logo of ${props.name}`} />
				<span>{props.name}</span>
				{props.token?.symbol && props.token.symbol !== '-' ? (
					<span className="font-normal">({props.token.symbol})</span>
				) : null}
				{props.deprecated ? <DeprecatedProtocolMarker size={18} /> : null}
				<span className="-m-2 ml-auto flex items-center justify-end gap-1">
					{props.website ? (
						<WebsiteGlobeLink
							url={props.website}
							name={props.name}
							event="protocol-website-click"
							eventData={{ protocol: props.name, referral: String(!!props.isWebsiteReferral) }}
						/>
					) : null}
					<Bookmark
						readableName={props.name}
						className={buttonStyles({ variant: 'ghost', size: 'md', square: true })}
					/>
				</span>
			</Tag>
			{primaryMetricOverride ? (
				<PrimaryValue
					hasTvl={true}
					value={primaryMetricOverride.value}
					name={props.name}
					category={props.category ?? ''}
					valueByChain={primaryMetricOverride.valueByChain}
					formatPrice={formatPrice}
					title={primaryMetricOverride.title}
					byChainTitle={primaryMetricOverride.byChainTitle}
				/>
			) : props.oracleTvs ? (
				<PrimaryValue
					hasTvl={true}
					value={oracleTvs}
					name={props.name}
					category={'Oracle'}
					valueByChain={oracleTvsByChain}
					formatPrice={formatPrice}
				/>
			) : (
				<PrimaryValue
					hasTvl={props.metrics.tvl}
					value={tvl}
					name={props.name}
					category={props.category === 'Oracle' ? '' : (props.category ?? '')}
					valueByChain={tvlByChain}
					formatPrice={formatPrice}
				/>
			)}
		</>
	)
}

const PrimaryValue = ({
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
	value: number
	name: string
	category: string
	formatPrice: (value: number | string | null) => string | number | null
	valueByChain?: [string, number][]
	title?: string
	byChainTitle?: string
}) => {
	if (!hasTvl) return null

	const defaultLabels = getPrimaryValueLabelType(category)
	const title = titleOverride ?? defaultLabels.title
	const byChainTitle = byChainTitleOverride ?? defaultLabels.byChainTitle

	if (!valueByChain || valueByChain.length === 0) {
		return (
			<p className="flex flex-col">
				<span className="flex flex-nowrap items-center gap-2">
					<span className="text-secondary">{title}</span>
				</span>
				<span className="min-h-8 font-jetbrains text-2xl font-semibold" suppressHydrationWarning>
					{formatPrice(value)}
				</span>
			</p>
		)
	}

	return (
		<details className="group">
			<summary className="flex flex-col">
				<span className="flex flex-nowrap items-center gap-2">
					<span className="text-secondary">{title}</span>
				</span>
				<span className="flex flex-nowrap items-center gap-2">
					<span className="min-h-8 font-jetbrains text-2xl font-semibold" suppressHydrationWarning>
						{formatPrice(value)}
					</span>
					<Icon
						name="chevron-down"
						height={16}
						width={16}
						className="relative top-0.5 text-tertiary transition-transform duration-100 group-open:rotate-180"
					/>
				</span>
			</summary>
			<div className="my-3 flex max-h-[50dvh] flex-col overflow-auto">
				<h2 className="font-semibold">{byChainTitle}</h2>
				{valueByChain.map(([chain, tvl]) => (
					<p
						key={`${chain}-${tvl}-${name}`}
						className="flex items-center justify-between gap-1 border-b border-dashed border-subtle py-1 group-last:border-none"
					>
						<span className="text-secondary">{chain}</span>
						<span className="font-jetbrains">{formatPrice(tvl)}</span>
					</p>
				))}
			</div>
		</details>
	)
}
