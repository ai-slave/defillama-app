import { useRouter } from 'next/router'
import { lazy, Suspense } from 'react'
import { DeprecatedEntityText } from '~/components/DeprecatedEntityMarker'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { Icon } from '~/components/Icon'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { TokenLogo } from '~/components/TokenLogo'
import { IrTabLabel } from '~/containers/Investors/IrTabLabel'
import { getMainSiteIrDashboard } from '~/containers/Investors/mainSiteDashboards'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import { useAuthContext } from '~/containers/Subscription/auth'
import { Card } from '~/ui/Card'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { PanelStatus } from '~/ui/Status'
import { TabLink, tabTrackStyles } from '~/ui/Tab'
import { slug } from '~/utils'
import { SmolStats } from './SmolStats'
import { Stats } from './Stats'
import type { IChainOverviewData } from './types'

// Lazy-loaded: pulls in the full ProDashboard stack (@dnd-kit, react-query, ChartGrid, dataset modules).
// ChainOverview is in the homepage's initial bundle, so keep that stack out of it — it only renders for
// is_llama users who open the IR tab. Matches the lazy() pattern used by pages/pro and pages/investors.
const InvestorRelationsView = lazy(() =>
	import('~/containers/Investors/InvestorRelationsView').then((m) => ({ default: m.InvestorRelationsView }))
)

export function ChainOverview(props: IChainOverviewData) {
	const router = useRouter()
	const { user } = useAuthContext()
	const entitySlug = slug(props.metadata.name)
	const irDashboard = getMainSiteIrDashboard('chain', entitySlug)
	const showInvestorRelations = !!irDashboard && user?.flags?.is_llama === true
	const irActive = showInvestorRelations && router.query.tab === 'investor-relations'

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
			<RowLinksWithDropdown links={props.allChains} activeLink={props.metadata.name} />
			<div className="isolate flex flex-1 flex-col gap-2">
				{showInvestorRelations && irDashboard ? (
					<nav className={tabTrackStyles}>
						<TabLink as="button" type="button" onClick={() => goToTab(undefined)} data-active={!irActive}>
							Overview
						</TabLink>
						<TabLink
							as="button"
							type="button"
							onClick={() => goToTab('investor-relations')}
							data-active={irActive}
							className="flex items-center gap-1.5"
						>
							<IrTabLabel label={irDashboard.tabLabel} gradient={irDashboard.brandGradient} active={irActive} />
						</TabLink>
					</nav>
				) : null}
				{props.metadata.name !== 'All' && !irActive ? (
					<EntityQuestionsStrip
						questions={props.entityQuestions || []}
						entitySlug={entitySlug}
						entityType="chain"
						entityName={props.metadata.name}
					/>
				) : null}
				{irActive && irDashboard ? (
					<Suspense fallback={null}>
						<InvestorRelationsView
							dashboardId={irDashboard.dashboardId}
							customOnly={irDashboard.customOnly}
							entityName={props.metadata.name}
						/>
					</Suspense>
				) : (
					<>
						{props.isDataAvailable ? (
							<>
								<Stats {...props} />
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
										className="relative flex max-h-[64px] w-full max-w-[70vw] min-w-[270px] flex-1 items-center gap-2.5 overflow-hidden"
									>
										{app.background}
										<>{app.icon}</>
										<span className="flex flex-1 flex-col gap-0.5">
											<span className="col-span-1 row-span-1 overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap">
												{app.name}
											</span>
											{app.description === '' ? null : (
												<span className="col-span-1 row-span-1 overflow-hidden text-sm font-light text-ellipsis whitespace-nowrap">
													{app.description}
												</span>
											)}
										</span>
										<Icon name="arrow-up-right-2" className="size-6 shrink-0" />
									</Card>
								))}
							</div>
						) : null}
						<NewsletterSignup layout="strip" />
						{props.protocols.length > 0 ? <ChainProtocolsTable protocols={props.protocols} /> : null}
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
		),
		background: <span className="llama-app-background" />
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
		),
		background: <span className="llama-app-background" />
	},
	{
		name: 'LlamaSwap',
		description: 'No fees DEX aggregator',
		href: 'https://swap.defillama.com',
		icon: (
			<img src="/assets/llamaswap.svg" loading="lazy" alt="" height={44} width={44} className="z-10 object-contain" />
		),
		background: <span className="llama-app-background" />
	},
	{
		name: 'DefiLlama API',
		description: 'Access to all our data',
		href: 'https://defillama.com/pro-api/docs',
		icon: (
			<img src="/assets/llamaswap.svg" loading="lazy" alt="" height={44} width={44} className="z-10 object-contain" />
		),
		background: <span className="llama-app-background" />
	},
	{
		name: 'LlamaFeed',
		description: 'The ultimate crypto feed',
		href: 'https://llamafeed.io/',
		icon: (
			<img src="/assets/llamafeed.svg" loading="lazy" alt="" height={44} width={44} className="z-10 object-contain" />
		),
		background: <span className="llama-app-background" />
	}
]
