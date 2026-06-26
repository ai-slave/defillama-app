import { useRouter } from 'next/router'
import { lazy, Suspense } from 'react'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { Icon } from '~/components/Icon'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { TokenLogo } from '~/components/TokenLogo'
import { IrTabLabel } from '~/containers/Investors/IrTabLabel'
import { getMainSiteIrDashboard } from '~/containers/Investors/mainSiteDashboards'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import { useAuthContext } from '~/containers/Subscription/auth'
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
					<div className="flex w-full shrink-0 overflow-x-auto text-xs font-medium">
						<button
							onClick={() => goToTab(undefined)}
							data-active={!irActive}
							className="shrink-0 border-b-2 border-(--form-control-border) px-4 py-1 whitespace-nowrap hover:bg-(--btn-hover-bg) focus-visible:bg-(--btn-hover-bg) data-[active=true]:border-(--primary)"
						>
							Overview
						</button>
						<button
							onClick={() => goToTab('investor-relations')}
							data-active={irActive}
							className="relative flex shrink-0 items-center gap-1 border-b-2 border-(--form-control-border) px-4 py-1 font-semibold whitespace-nowrap hover:bg-(--btn-hover-bg) focus-visible:bg-(--btn-hover-bg)"
						>
							<IrTabLabel
								label={irDashboard.tabLabel}
								tooltip={irDashboard.tabTooltip}
								gradient={irDashboard.brandGradient}
								active={irActive}
							/>
						</button>
					</div>
				) : null}
				{props.metadata.name !== 'All' ? (
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
								<div className="flex flex-1 flex-col gap-10 rounded-md border border-(--cards-border) bg-(--cards-bg) p-2">
									<h1 className="flex flex-nowrap items-center gap-2">
										<TokenLogo
											name={props.metadata.name}
											kind="chain"
											size={24}
											alt={`Logo of ${props.metadata.name}`}
										/>
										<span className="text-xl font-semibold">{props.metadata.name}</span>
									</h1>
									<p className="my-auto py-10 text-center text-sm text-(--text-form)">
										We don't track any protocols with TVL, Fees, Revenue or Volume on this chain
									</p>
								</div>
							</>
						)}
						{props.metadata.name === 'All' ? (
							<div className="relative isolate flex thin-scrollbar shrink-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden">
								{linksToOtherLlamaApps.map((app) => (
									<a
										target="_blank"
										rel="noreferrer noopener"
										href={app.href}
										key={`llama-app-${app.href}`}
										className="relative flex max-h-[64px] w-full max-w-[70vw] min-w-[270px] flex-1 items-center gap-2.5 overflow-hidden rounded-lg border border-(--cards-bg) bg-(--cards-bg) p-2.5"
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
									</a>
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
