import * as Ariakit from '@ariakit/react'
import { useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { Announcement } from '~/components/Announcement'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { BasicLink, ButtonLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { WarningBanners } from '~/containers/ChainOverview/WarningBanners'
import { IrTabLabel } from '~/containers/Investors/IrTabLabel'
import { IrTabMenu } from '~/containers/Investors/IrTabMenu'
import { getMainSiteIrBaseHref } from '~/containers/Investors/mainSiteDashboards'
import Layout from '~/layout'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/PopoverSurface'
import { InlineStatus } from '~/ui/Status'
import { TabLink, TabNav } from '~/ui/Tabs'
import { slug } from '~/utils'
import {
	getProtocolLayoutSeo,
	type ProtocolTab,
	protocolTabs as tabs,
	resolveProtocolDashboards,
	showsActiveLoansTvlNotice
} from './layoutSeo'
import type { IProtocolPageMetrics } from './types'

export function ProtocolOverviewLayout({
	children,
	isCEX,
	name,
	category,
	otherProtocols,
	toggleOptions,
	metrics,
	tab,
	irTab,
	warningBanners,
	seoTitle,
	seoDescription,
	entityQuestions
}: {
	children: React.ReactNode
	isCEX?: boolean
	name: string
	category?: string | null
	otherProtocols?: Array<string> | null
	toggleOptions?: Array<{
		name: string
		key: string
	}>
	metrics: IProtocolPageMetrics
	tab: ProtocolTab
	irTab?: string
	warningBanners?: Array<{
		message: string
		until?: number | string // unix timestamp or "forever" or date string  in 'YYYY-MM-DD' format, 'forever' if the field is not set
		level: 'low' | 'alert' | 'rug'
	}>
	seoTitle?: string
	seoDescription?: string
	entityQuestions?: Array<string>
}) {
	const { user } = useAuthContext()

	const protocolTabs = useMemo(() => {
		const final = []
		// Sits directly after TVL: for an RWA platform it is the metric TVL used to stand in for.
		if (metrics.rwa) {
			final.push(tabs.rwa)
		}
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
		if (metrics.forks) {
			final.push(tabs.forks)
		}
		if (metrics.cryptoCards) {
			final.push(tabs.cardDetails)
		}
		return final
	}, [metrics])

	const entitySlug = slug(name)
	const seo = getProtocolLayoutSeo({ name, isCEX, tab, seoTitle, seoDescription })
	const { investorRelations: irDashboard, announcement: dashboardAnnouncement } = resolveProtocolDashboards({
		name,
		isCEX,
		otherProtocols,
		user: { id: user?.id, isLlama: user?.flags?.is_llama === true }
	})

	return (
		<Layout
			title={seo.title}
			description={seo.description}
			canonicalUrl={seo.canonicalUrl}
			noIndex={seo.noIndex}
			{...(isCEX ? { pageName: ['Exchanges'] } : {})}
			{...(toggleOptions !== undefined ? { tvlOptions: toggleOptions } : {})}
		>
			{showsActiveLoansTvlNotice(tab, category) ? (
				<InlineStatus variant="info">
					<p>
						Active loans are not included in TVL by default, to include them toggle Active Loans. For more info, read
						the{' '}
						<a
							href="https://github.com/DefiLlama/DefiLlama-Adapters/discussions/6163"
							target="_blank"
							rel="noreferrer noopener"
							className="underline"
						>
							active loans discussion
						</a>
						.
					</p>
				</InlineStatus>
			) : null}

			<WarningBanners banners={warningBanners} entityName={name} />

			{dashboardAnnouncement ? (
				<Announcement
					announcementId={dashboardAnnouncement.announcementId}
					version={dashboardAnnouncement.version}
					scope={dashboardAnnouncement.scope}
				>
					<span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
						<span
							className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 title-sm ${dashboardAnnouncement.badgeClassName}`}
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
							href={dashboardAnnouncement.resolvedHref}
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
				<TabNav label={`${name} pages`}>
					{(otherProtocols?.length ?? 0) > 1 ? (
						<Ariakit.MenuProvider>
							<Ariakit.MenuButton render={<Button size="sm" className="my-auto mr-4" />}>
								<TokenLogo name={name} kind="token" size={16} alt={`Logo of ${name}`} />
								<span className="whitespace-nowrap">{name === otherProtocols?.[0] ? `${name} (Combined)` : name}</span>
								<Icon name="chevron-down" className="size-3.5 shrink-0 text-tertiary" />
							</Ariakit.MenuButton>
							<MenuSurface variant="actions">
								{otherProtocols?.map((value, i) => (
									<MenuItem
										key={`navigate to /protocol/${slug(value)}`}
										row={i === 0 ? 'tree' : 'tree-child'}
										render={<BasicLink href={`/protocol/${slug(value)}`} />}
										data-active={name === value}
									>
										<TokenLogo name={value} kind="token" size={24} alt={`Logo of ${value}`} />
										{i === 0 ? (
											<span className="flex flex-col">
												<span>{`${value} (Combined)`}</span>
												<span className="label-xs text-tertiary">Aggregated view</span>
											</span>
										) : (
											<span>{value}</span>
										)}
									</MenuItem>
								))}
							</MenuSurface>
						</Ariakit.MenuProvider>
					) : null}

					{isCEX ? (
						<>
							<TabLink
								as={ButtonLink}
								href={`/cex/${slug(name)}`}
								aria-current={!tab || tab === 'information' ? 'page' : undefined}
							>
								Information
							</TabLink>
							{metrics.tvl ? (
								<TabLink
									as={ButtonLink}
									href={`/cex/assets/${slug(name)}`}
									aria-current={tab === 'assets' ? 'page' : undefined}
								>
									Assets
								</TabLink>
							) : null}
							{metrics.stablecoins ? (
								<TabLink
									as={ButtonLink}
									href={`/cex/stablecoins/${slug(name)}`}
									aria-current={tab === 'stablecoins' ? 'page' : undefined}
								>
									Stablecoin Info
								</TabLink>
							) : null}
							{metrics.cryptoCards ? (
								<TabLink
									as={ButtonLink}
									href={`/cex/card-details/${slug(name)}`}
									aria-current={tab === 'cardDetails' ? 'page' : undefined}
								>
									Card Details
								</TabLink>
							) : null}
						</>
					) : (
						<>
							<TabLink
								as={ButtonLink}
								href={`/protocol/${slug(name)}`}
								aria-current={!tab || tab === 'information' ? 'page' : undefined}
							>
								Information
							</TabLink>
							{metrics.tvl ? (
								<TabLink
									as={ButtonLink}
									href={`/protocol/tvl/${slug(name)}`}
									aria-current={tab === 'tvl' ? 'page' : undefined}
								>
									TVL
								</TabLink>
							) : null}
						</>
					)}
					{!isCEX
						? protocolTabs.map((pt) => (
								<TabLink
									as={ButtonLink}
									key={`${pt.id}-${name}`}
									href={`${pt.route}/${slug(name)}`}
									aria-current={pt.id === tab ? 'page' : undefined}
								>
									{pt.name}
								</TabLink>
							))
						: null}
					{irDashboard ? (
						irDashboard.tabPlacement === 'menu' ? (
							<IrTabMenu dashboard={irDashboard} active={tab === 'investorRelations'} activeTabId={irTab} />
						) : (
							<TabLink
								as={ButtonLink}
								href={getMainSiteIrBaseHref(irDashboard)}
								aria-current={tab === 'investorRelations' ? 'page' : undefined}
								data-umami-event="investor-relations-tab-click"
								data-umami-event-entity-type="protocol"
								data-umami-event-entity={entitySlug}
								data-umami-event-dashboard-id={irDashboard.dashboardId}
							>
								<IrTabLabel
									label={irDashboard.tabLabel}
									gradient={irDashboard.brandGradient}
									active={tab === 'investorRelations'}
								/>
							</TabLink>
						)
					) : null}
				</TabNav>
				{tab !== 'investorRelations' && entityQuestions ? (
					<EntityQuestionsStrip
						questions={entityQuestions}
						entitySlug={slug(name)}
						entityType="protocol"
						entityName={name}
					/>
				) : null}
				{children}
			</div>
		</Layout>
	)
}
