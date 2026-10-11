import { useRouter } from 'next/router'
import { lazy, Suspense } from 'react'
import { useAuthContext } from '~/auth'
import { DeprecatedEntityText } from '~/components/DeprecatedEntityMarker'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { SponsoredResearchReportsCard } from '~/components/Research/SponsoredResearchReportsCard'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { TokenLogo } from '~/components/TokenLogo'
import { IrTabLabel } from '~/containers/Investors/IrTabLabel'
import { HomeDailyBrief } from '~/containers/LlamaAI/dailyBrief/HomeDailyBrief'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import { Card } from '~/ui/Card'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { Icon } from '~/ui/Icon'
import { PanelStatus } from '~/ui/Status'
import { TabLink, TabNav } from '~/ui/Tabs'
import { slug } from '~/utils'
import { getChainInvestorRelationsTab } from './investorRelationsTab'
import { SmolStats } from './SmolStats'
import { Stats } from './Stats'
import type { IChainOverviewData } from './types'

const InvestorRelationsView = lazy(() =>
	import('~/containers/Investors/InvestorRelationsView').then((m) => ({ default: m.InvestorRelationsView }))
)

export function ChainOverview(props: Omit<IChainOverviewData, 'extraTvlCharts'>) {
	const router = useRouter()
	const entitySlug = slug(props.metadata.name)
	const researchSponsorEntitySlug = props.researchSponsorEntitySlug ?? entitySlug
	const { user } = useAuthContext()
	const investorRelations = getChainInvestorRelationsTab(
		props.metadata.name,
		router.query.tab,
		user?.flags?.is_llama === true
	)
	const irActive = investorRelations?.active === true

	const goToTab = (tab?: string) => {
		const query = { ...router.query }
		if (tab) {
			query.tab = tab
		} else {
			delete query.tab
		}
		router.push({ pathname: router.pathname, query }, undefined, { shallow: true })
	}

	return (
		<>
			<RowLinksWithDropdown heading="Chains" links={props.allChains} activeLink={props.metadata.name} />
			<div className="isolate flex flex-1 flex-col gap-2">
				{investorRelations ? (
					<TabNav label={`${props.metadata.name} pages`} className="shrink-0">
						<TabLink
							as="button"
							type="button"
							onClick={() => goToTab(undefined)}
							aria-current={!irActive ? 'page' : undefined}
							className="flex items-center"
						>
							Overview
						</TabLink>
						<TabLink
							as="button"
							type="button"
							onClick={() => goToTab('investor-relations')}
							aria-current={irActive ? 'page' : undefined}
							data-umami-event="investor-relations-tab-click"
							data-umami-event-entity-type="chain"
							data-umami-event-entity={entitySlug}
							data-umami-event-dashboard-id={investorRelations.dashboard.dashboardId}
							className="flex items-center gap-1.5"
						>
							<IrTabLabel
								label={investorRelations.dashboard.tabLabel}
								gradient={investorRelations.dashboard.brandGradient}
								active={irActive}
							/>
						</TabLink>
					</TabNav>
				) : null}
				{props.metadata.name !== 'All' && !irActive ? (
					<EntityQuestionsStrip
						questions={props.entityQuestions || []}
						entitySlug={entitySlug}
						entityType="chain"
						entityName={props.metadata.name}
					/>
				) : null}
				{investorRelations?.active ? (
					<Suspense fallback={null}>
						<InvestorRelationsView
							dashboardId={investorRelations.dashboard.dashboardId}
							customOnly={investorRelations.dashboard.customOnly}
							entityName={props.metadata.name}
							customServerData={props.customServerData}
						/>
					</Suspense>
				) : (
					<>
						{props.dailyBrief ? <HomeDailyBrief brief={props.dailyBrief} /> : null}
						{props.isDataAvailable ? (
							<>
								<Stats {...props} extraTvlCharts={null} />
								<SmolStats {...props} />
							</>
						) : (
							<>
								<EntityTitleStrip
									media={
										<TokenLogo
											name={props.metadata.name}
											kind="chain"
											size={28}
											alt={`Logo of ${props.metadata.name}`}
										/>
									}
									title={props.metadata.name}
									actions={props.metadata.deprecated ? <DeprecatedEntityText /> : null}
								/>
								<PanelStatus variant="empty">
									We don't track any protocols with TVL, Fees, Revenue or Volume on this chain
								</PanelStatus>
							</>
						)}
						{props.metadata.name === 'All' ? (
							<div className="relative isolate flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden">
								{linksToOtherLlamaApps.map((app) => (
									<Card
										as="a"
										target="_blank"
										rel="noreferrer noopener"
										href={app.href}
										key={`llama-app-${app.href}`}
										padding="sm"
										className="hover-wash-card relative flex max-h-[64px] w-full max-w-[70vw] min-w-[270px] flex-1 items-center gap-2.5 overflow-hidden"
									>
										<>{app.icon}</>
										<span className="flex flex-1 flex-col gap-0.5">
											<span className="truncate title-md">{app.name}</span>
											{app.description === '' ? null : (
												<span className="truncate body-md text-secondary">{app.description}</span>
											)}
										</span>
										<Icon name="arrow-up-right" className="size-6 shrink-0" />
									</Card>
								))}
							</div>
						) : null}
						{props.metadata.name !== 'All' ? (
							<SponsoredResearchReportsCard
								reports={props.sponsoredResearchReports}
								entityType="chain"
								entitySlug={researchSponsorEntitySlug}
								layout="grid"
							/>
						) : null}
						<NewsletterSignup layout="strip" />
						{props.protocolRankings.total > 0 ? (
							<ChainProtocolsTable
								protocols={props.protocols}
								protocolRankings={props.protocolRankings}
								chain={props.chain}
								showExtendedMetrics
							/>
						) : null}
					</>
				)}
			</div>
		</>
	)
}

const linksToOtherLlamaApps = [
	{
		name: '',
		description: '',
		href: '/research',
		icon: (
			<span aria-label="DefiLlama Research" role="img" className="relative z-10 block h-11 w-32 shrink-0">
				<img
					src="/assets/research_logo_dark.webp"
					alt=""
					height={44}
					width={128}
					loading="lazy"
					className="invisible absolute inset-0 h-full w-full object-contain dark:visible"
				/>
				<img
					src="/assets/research_logo.webp"
					alt=""
					height={44}
					width={128}
					loading="lazy"
					className="visible absolute inset-0 h-full w-full object-contain dark:invisible"
				/>
			</span>
		)
	},
	{
		name: 'LlamaSearch',
		description: 'Find official links to projects',
		href: 'https://search.defillama.com',
		icon: (
			<img
				src="/assets/llamasearch.svg"
				loading="lazy"
				alt=""
				height={44}
				width={39.28}
				className="z-10 object-contain"
			/>
		)
	},
	{
		name: 'LlamaSwap',
		description: 'No fees DEX aggregator',
		href: 'https://swap.defillama.com',
		icon: (
			<img src="/assets/llamaswap.svg" loading="lazy" alt="" height={44} width={44} className="z-10 object-contain" />
		)
	},
	{
		name: 'DefiLlama API',
		description: 'Access to all our data',
		href: 'https://defillama.com/pro-api/docs',
		icon: (
			<img src="/assets/llamaswap.svg" loading="lazy" alt="" height={44} width={44} className="z-10 object-contain" />
		)
	},
	{
		name: 'LlamaFeed',
		description: 'The ultimate crypto feed',
		href: 'https://llamafeed.io/',
		icon: (
			<img src="/assets/llamafeed.svg" loading="lazy" alt="" height={44} width={44} className="z-10 object-contain" />
		)
	}
]
