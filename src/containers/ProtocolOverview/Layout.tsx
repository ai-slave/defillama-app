import * as Ariakit from '@ariakit/react'
import { useMemo } from 'react'
import { Announcement } from '~/components/Announcement'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { getMetricFiltersLabel } from '~/components/Filters/options'
import { Icon } from '~/components/Icon'
import { BasicLink, ButtonLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { IrTabLabel } from '~/containers/Investors/IrTabLabel'
import { getMainSiteIrDashboard } from '~/containers/Investors/mainSiteDashboards'
import { useAuthContext } from '~/containers/Subscription/auth'
import Layout from '~/layout'
import { slug } from '~/utils'
import type { IProtocolPageMetrics } from './types'

const tabs = {
	information: { id: 'information', name: 'Information', route: '/protocol' },
	assets: { id: 'assets', name: 'Assets', route: '/protocol/assets' },
	tvl: { id: 'tvl', name: 'TVL', route: '/protocol/tvl' },
	borrowed: { id: 'borrowed', name: 'Active Loans', route: '/protocol/active-loans' },
	stablecoins: { id: 'stablecoins', name: 'Stablecoin Info', route: '/protocol/stablecoins' },
	markets: { id: 'markets', name: 'Markets', route: '/cex/markets' },
	bridges: { id: 'bridges', name: 'Bridge Info', route: '/protocol/bridges' },
	treasury: { id: 'treasury', name: 'Treasury', route: '/protocol/treasury' },
	unlocks: { id: 'unlocks', name: 'Unlocks', route: '/protocol/unlocks' },
	yields: { id: 'yields', name: 'Yields', route: '/protocol/yields' },
	fees: { id: 'fees', name: 'Fees and Revenue', route: '/protocol/fees' },
	dexs: { id: 'dexs', name: 'DEX Volume', route: '/protocol/dexs' },
	perps: { id: 'perps', name: 'Perp Volume', route: '/protocol/perps' },
	dexAggregators: { id: 'dexAggregators', name: 'DEX Aggregator Volume', route: '/protocol/dex-aggregators' },
	perpsAggregators: { id: 'perpsAggregators', name: 'Perp Aggregator Volume', route: '/protocol/perps-aggregators' },
	bridgeAggregators: {
		id: 'bridgeAggregators',
		name: 'Bridge Aggregator Volume',
		route: '/protocol/bridge-aggregators'
	},
	options: { id: 'options', name: 'Options Volume', route: '/protocol/options' },
	tokenRights: { id: 'tokenRights', name: 'Token Rights', route: '/protocol/token-rights' },
	governance: { id: 'governance', name: 'Governance', route: '/protocol/governance' },
	forks: { id: 'forks', name: 'Forks', route: '/protocol/forks' },
	investorRelations: { id: 'investorRelations', name: 'Investor Relations', route: '/protocol/investor-relations' }
} as const

const standaloneCanonicals: Partial<Record<keyof typeof tabs, string>> = {
	information: '/protocol',
	markets: '/cex/markets',
	borrowed: '/protocol/active-loans',
	unlocks: '/unlocks',
	governance: '/governance',
	forks: '/forks'
}

const noIndexProtocolSlugs = new Set(['defi-swap'])

type ProtocolDashboardAnnouncement = {
	announcementId: string
	version: string
	badgeLabel: string
	href: string
	linkLabel: string
	prefix: string
	suffix: string
	className: string
	badgeClassName: string
	logoName?: string
	includeReferrer?: boolean
}

const sparkDashboardAnnouncementClassName =
	'border border-[#ffb27a] bg-[linear-gradient(90deg,rgba(255,244,234,0.98),rgba(255,232,213,0.98)_38%,rgba(255,219,225,0.95)_100%)] text-[#7a3d0c] shadow-[0_8px_20px_rgba(255,142,43,0.14)] dark:border-[#8f4e1e] dark:bg-[linear-gradient(90deg,rgba(66,43,27,0.96),rgba(81,35,33,0.94)_55%,rgba(94,26,40,0.94)_100%)] dark:text-[#ffe8d5]'
const sparkDashboardBadgeClassName =
	'border border-white/70 bg-white/70 text-[#8d4c12] shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-[#ffd2aa]'

const odysseyEnterpriseDashboardAnnouncement = {
	announcementId: 'odyssey-enterprise-dashboard',
	version: '2026-06-19',
	badgeLabel: 'Odyssey Enterprise',
	href: 'https://enterprise.defillama.com/odyssey-ecosystem',
	linkLabel: 'Enterprise Dashboard',
	prefix: 'View the Odyssey',
	suffix: 'for ecosystem analytics across Odyssey, Vesper, and Metronome.',
	className:
		'border border-[#8ecae6] bg-[linear-gradient(90deg,rgba(236,249,255,0.98),rgba(228,245,242,0.98)_42%,rgba(236,242,255,0.95)_100%)] text-[#0f4f66] shadow-[0_8px_20px_rgba(42,157,143,0.12)] dark:border-[#2f6f83] dark:bg-[linear-gradient(90deg,rgba(20,48,58,0.96),rgba(24,57,52,0.94)_55%,rgba(28,46,72,0.94)_100%)] dark:text-[#d9f4ff]',
	badgeClassName:
		'border border-white/70 bg-white/70 text-[#12617a] shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-[#b7edff]',
	logoName: 'Odyssey Finance'
} satisfies ProtocolDashboardAnnouncement

const protocolDashboardAnnouncements: Record<string, ProtocolDashboardAnnouncement> = {
	spark: {
		announcementId: 'spark-investor-relations',
		version: '2026-04-15',
		badgeLabel: 'Spark IR',
		href: 'https://investors.defillama.com/spark',
		linkLabel: 'investor relations dashboard',
		prefix: "View Spark's",
		suffix: 'for deeper analytics and investor reports.',
		className: sparkDashboardAnnouncementClassName,
		badgeClassName: sparkDashboardBadgeClassName,
		includeReferrer: true
	},
	vesper: odysseyEnterpriseDashboardAnnouncement,
	'odyssey-finance': odysseyEnterpriseDashboardAnnouncement,
	metronome: odysseyEnterpriseDashboardAnnouncement,
	'metronome-synth': odysseyEnterpriseDashboardAnnouncement
} satisfies Record<string, ProtocolDashboardAnnouncement>

export function ProtocolOverviewLayout({
	children,
	isCEX,
	name,
	category,
	otherProtocols,
	toggleOptions,
	metrics,
	tab,
	warningBanners,
	seoTitle,
	seoDescription,
	entityQuestions,
	cexMarketsExchange,
	cexMarketsSlug
}: {
	children: React.ReactNode
	isCEX?: boolean
	name: string
	category: string
	otherProtocols?: Array<string>
	toggleOptions?: Array<{
		name: string
		key: string
	}>
	metrics: IProtocolPageMetrics
	tab: keyof typeof tabs
	warningBanners?: Array<{
		message: string
		until?: number | string // unix timestamp or "forever" or date string  in 'YYYY-MM-DD' format, 'forever' if the field is not set
		level: 'low' | 'alert' | 'rug'
	}>
	seoTitle?: string
	seoDescription?: string
	entityQuestions?: string[]
	cexMarketsExchange?: string | null
	cexMarketsSlug?: string | null
}) {
	const { user } = useAuthContext()

	const metricFiltersLabel = useMemo(() => getMetricFiltersLabel(toggleOptions), [toggleOptions])

	const protocolTabs = useMemo(() => {
		const final = []
		if (metrics.borrowed) {
			final.push(tabs.borrowed)
		}
		if (metrics.stablecoins) {
			final.push(tabs.stablecoins)
		}
		if (metrics.bridge) {
			final.push(tabs.bridges)
		}
		if (metrics.treasury) {
			final.push(tabs.treasury)
		}
		if (metrics.unlocks) {
			final.push(tabs.unlocks)
		}
		if (metrics.yields) {
			final.push(tabs.yields)
		}
		if (metrics.fees) {
			final.push(tabs.fees)
		}
		if (metrics.dexs) {
			final.push(tabs.dexs)
		}
		if (metrics.perps) {
			final.push(tabs.perps)
		}
		if (metrics.dexAggregators) {
			final.push(tabs.dexAggregators)
		}
		if (metrics.perpsAggregators) {
			final.push(tabs.perpsAggregators)
		}
		if (metrics.bridgeAggregators) {
			final.push(tabs.bridgeAggregators)
		}
		if (metrics.optionsPremiumVolume || metrics.optionsNotionalVolume) {
			final.push(tabs.options)
		}
		if (metrics.tokenRights) {
			final.push(tabs.tokenRights)
		}
		if (metrics.governance) {
			final.push(tabs.governance)
		}
		if (metrics.forks) {
			final.push(tabs.forks)
		}
		return final
	}, [metrics])

	const entitySlug = slug(name)
	const irDashboard = isCEX ? undefined : getMainSiteIrDashboard('protocol', entitySlug)
	const showInvestorRelations = !!irDashboard && user?.flags?.is_llama === true
	const cexMarketsRouteSlug = cexMarketsSlug ? slug(cexMarketsSlug) : null
	const shouldNoIndex = !standaloneCanonicals[tab] || noIndexProtocolSlugs.has(entitySlug)
	const canonicalUrl = isCEX
		? tab === 'assets'
			? `/cex/assets/${entitySlug}`
			: tab === 'stablecoins'
				? `/cex/stablecoins/${entitySlug}`
				: tab === 'markets'
					? cexMarketsRouteSlug
						? `/cex/markets/${cexMarketsRouteSlug}`
						: null
					: `/cex/${entitySlug}`
		: !tab || tab === 'information'
			? `/protocol/${entitySlug}`
			: tab === 'tvl'
				? `/protocol/tvl/${entitySlug}`
				: tab && standaloneCanonicals[tab]
					? `${standaloneCanonicals[tab]}/${entitySlug}`
					: `${tabs[tab].route}/${entitySlug}`

	const resolvedTitle = seoTitle || `${name} Protocol Overview - DefiLlama`
	const resolvedDescription =
		seoDescription ||
		`Track ${name} metrics on DefiLlama. DefiLlama is committed to providing accurate data without ads or sponsored content, as well as transparency.`
	const dashboardAnnouncement = showInvestorRelations ? undefined : protocolDashboardAnnouncements[entitySlug]
	const dashboardAnnouncementHref =
		dashboardAnnouncement?.includeReferrer && user?.id
			? `${dashboardAnnouncement.href}?referrer=${encodeURIComponent(user.id)}`
			: dashboardAnnouncement?.href

	return (
		<Layout
			title={resolvedTitle}
			description={resolvedDescription}
			canonicalUrl={standaloneCanonicals[tab] ? canonicalUrl : null}
			noIndex={shouldNoIndex}
			metricFilters={toggleOptions}
			metricFiltersLabel={metricFiltersLabel ?? undefined}
		>
			{category === 'Uncollateralized Lending' || category === 'RWA Lending' ? (
				<p className="relative rounded-md border border-(--bg-color) bg-(--btn-bg) p-2 text-center text-xs text-black dark:text-white">
					Active loans are not included in TVL by default, to include them toggle Active Loans. For more info on this
					click{' '}
					<a
						href="https://github.com/DefiLlama/DefiLlama-Adapters/discussions/6163"
						target="_blank"
						rel="noreferrer noopener"
						className="underline"
					>
						here
					</a>
					.
				</p>
			) : null}

			{warningBanners?.map((banner) => (
				<p
					className={`relative rounded-md border p-2 text-center text-xs text-black dark:text-white ${
						banner.level === 'rug'
							? 'border-(--error) bg-(--error)/20'
							: banner.level === 'alert'
								? 'border-(--warning) bg-(--warning)/20'
								: 'border-(--bg-color) bg-(--btn-bg)'
					}`}
					key={`${banner.message}-${banner.level}-${name}`}
				>
					{banner.message}
				</p>
			))}

			{dashboardAnnouncement ? (
				<Announcement
					announcementId={dashboardAnnouncement.announcementId}
					version={dashboardAnnouncement.version}
					className={dashboardAnnouncement.className}
					contentClassName="text-center"
				>
					<span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
						<span
							className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${dashboardAnnouncement.badgeClassName}`}
						>
							<TokenLogo
								name={dashboardAnnouncement.logoName ?? name}
								kind="token"
								size={14}
								alt={`Logo of ${dashboardAnnouncement.logoName ?? name}`}
							/>
							{dashboardAnnouncement.badgeLabel}
						</span>
						<span>{dashboardAnnouncement.prefix}</span>
						<a
							href={dashboardAnnouncementHref}
							target="_blank"
							rel="noopener noreferrer"
							className="underline decoration-2 underline-offset-[3px]"
						>
							{dashboardAnnouncement.linkLabel}
						</a>
						<span className="opacity-90">{dashboardAnnouncement.suffix}</span>
					</span>
				</Announcement>
			) : null}

			<div className="isolate flex flex-1 flex-col gap-2">
				<div className="flex w-full overflow-x-auto text-xs font-medium">
					{(otherProtocols?.length ?? 0) > 1 ? (
						<Ariakit.MenuProvider>
							<Ariakit.MenuButton className="mr-4 flex shrink-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-(--cards-border) bg-white px-2 py-1 font-normal hover:bg-(--link-hover-bg) focus-visible:bg-(--link-hover-bg) dark:bg-[#181A1C]">
								<TokenLogo name={name} kind="token" size={16} alt={`Logo of ${name}`} />
								<span className="whitespace-nowrap">{name === otherProtocols?.[0] ? `${name} (Combined)` : name}</span>
								<Ariakit.MenuButtonArrow />
							</Ariakit.MenuButton>
							<Ariakit.Menu
								unmountOnHide
								hideOnInteractOutside
								gutter={8}
								wrapperProps={{
									className: 'max-sm:fixed! max-sm:bottom-0! max-sm:top-[unset]! max-sm:transform-none! max-sm:w-full!'
								}}
								className="z-10 flex thin-scrollbar h-[calc(100dvh-80px)] min-w-[180px] flex-col overflow-auto overscroll-contain rounded-md border border-[hsl(204,20%,88%)] bg-(--bg-main) max-sm:drawer max-sm:rounded-b-none sm:max-h-[60dvh] lg:h-full lg:max-h-(--popover-available-height) dark:border-[hsl(204,3%,32%)]"
								portal
							>
								<Ariakit.PopoverDismiss className="ml-auto p-2 opacity-50 sm:hidden">
									<Icon name="x" className="size-5" />
								</Ariakit.PopoverDismiss>

								{otherProtocols?.map((value, i) => (
									<Ariakit.MenuItem
										key={`navigate to /protocol/${slug(value)}`}
										render={<BasicLink href={`/protocol/${slug(value)}`} />}
										data-active={name === value}
										className={`group relative flex items-center gap-2 py-2 ${
											i === 0 ? 'px-3' : 'ml-5.5 pr-3'
										} shrink-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap first-of-type:rounded-t-md hover:bg-(--primary-hover) focus-visible:bg-(--primary-hover) data-active-item:bg-(--primary-hover) data-[active=true]:bg-(--primary-hover)`}
									>
										{i !== 0 ? (
											<>
												<span className="absolute top-0 bottom-0 left-0 block h-full w-0.5 bg-(--form-control-border) group-last:h-[50%]" />
												<span className="-mr-2 h-0.5 w-3 bg-(--form-control-border)" />
											</>
										) : null}
										<TokenLogo name={value} kind="token" size={24} alt={`Logo of ${value}`} />
										{i === 0 ? (
											<span className="flex flex-col">
												<span>{`${value} (Combined)`}</span>
												<span className="text-[10px] text-(--text-form)">Aggregated view</span>
											</span>
										) : (
											<span>{value}</span>
										)}
									</Ariakit.MenuItem>
								))}
							</Ariakit.Menu>
						</Ariakit.MenuProvider>
					) : null}

					{isCEX ? (
						<>
							<ButtonLink
								href={`/cex/${slug(name)}`}
								data-active={!tab || tab === 'information'}
								className="shrink-0 border-b-2 border-(--form-control-border) px-4 py-1 whitespace-nowrap hover:bg-(--btn-hover-bg) focus-visible:bg-(--btn-hover-bg) data-[active=true]:border-(--primary)"
							>
								Information
							</ButtonLink>
							{metrics.tvl ? (
								<ButtonLink
									href={`/cex/assets/${slug(name)}`}
									data-active={tab === 'assets'}
									className="shrink-0 border-b-2 border-(--form-control-border) px-4 py-1 whitespace-nowrap hover:bg-(--btn-hover-bg) focus-visible:bg-(--btn-hover-bg) data-[active=true]:border-(--primary)"
								>
									Assets
								</ButtonLink>
							) : null}
							{metrics.stablecoins ? (
								<ButtonLink
									href={`/cex/stablecoins/${slug(name)}`}
									data-active={tab === 'stablecoins'}
									className="shrink-0 border-b-2 border-(--form-control-border) px-4 py-1 whitespace-nowrap hover:bg-(--btn-hover-bg) focus-visible:bg-(--btn-hover-bg) data-[active=true]:border-(--primary)"
								>
									Stablecoin Info
								</ButtonLink>
							) : null}
							{cexMarketsExchange && cexMarketsRouteSlug ? (
								<ButtonLink
									href={`/cex/markets/${cexMarketsRouteSlug}`}
									data-active={tab === 'markets'}
									className="shrink-0 border-b-2 border-(--form-control-border) px-4 py-1 whitespace-nowrap hover:bg-(--btn-hover-bg) focus-visible:bg-(--btn-hover-bg) data-[active=true]:border-(--primary)"
								>
									Markets
								</ButtonLink>
							) : null}
						</>
					) : (
						<>
							<ButtonLink
								href={`/protocol/${slug(name)}`}
								data-active={!tab || tab === 'information'}
								className="shrink-0 border-b-2 border-(--form-control-border) px-4 py-1 whitespace-nowrap hover:bg-(--btn-hover-bg) focus-visible:bg-(--btn-hover-bg) data-[active=true]:border-(--primary)"
							>
								Information
							</ButtonLink>
							{metrics.tvl ? (
								<ButtonLink
									href={`/protocol/tvl/${slug(name)}`}
									data-active={tab === 'tvl'}
									className="shrink-0 border-b-2 border-(--form-control-border) px-4 py-1 whitespace-nowrap hover:bg-(--btn-hover-bg) focus-visible:bg-(--btn-hover-bg) data-[active=true]:border-(--primary)"
								>
									TVL
								</ButtonLink>
							) : null}
						</>
					)}
					{protocolTabs
						.filter((pt) => (isCEX ? pt.id !== 'stablecoins' : true))
						.map((pt) => (
							<ButtonLink
								key={`${pt.id}-${name}`}
								href={`${pt.route}/${slug(name)}`}
								data-active={pt.id === tab}
								className="shrink-0 border-b-2 border-(--form-control-border) px-4 py-1 whitespace-nowrap hover:bg-(--btn-hover-bg) focus-visible:bg-(--btn-hover-bg) data-[active=true]:border-(--primary)"
							>
								{pt.name}
							</ButtonLink>
						))}
					{showInvestorRelations && irDashboard ? (
						<ButtonLink
							href={`/protocol/investor-relations/${entitySlug}`}
							data-active={tab === 'investorRelations'}
							className="relative flex shrink-0 items-center gap-1 border-b-2 border-(--form-control-border) px-4 py-1 font-semibold whitespace-nowrap hover:bg-(--btn-hover-bg) focus-visible:bg-(--btn-hover-bg)"
						>
							<IrTabLabel
								label={irDashboard.tabLabel}
								tooltip={irDashboard.tabTooltip}
								gradient={irDashboard.brandGradient}
								active={tab === 'investorRelations'}
							/>
						</ButtonLink>
					) : null}
				</div>
				<EntityQuestionsStrip
					questions={entityQuestions || []}
					entitySlug={slug(name)}
					entityType="protocol"
					entityName={name}
				/>
				{children}
			</div>
		</Layout>
	)
}
