import * as Ariakit from '@ariakit/react'
import { useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems, yieldsProtocolsHref } from '~/components/IconsRow/utils'
import { BasicLink, ButtonLink } from '~/components/Link'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { SponsoredResearchReportsCard } from '~/components/Research/SponsoredResearchReportsCard'
import { TokenLogo } from '~/components/TokenLogo'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { Menu } from '~/ui/Menu'
import { MetricRow } from '~/ui/MetricPrimitives'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import { getProtocolInfoCategories } from './category'
import type { IProtocolOverviewPageData } from './types'

const EMPTY_COMPETITORS: Array<{ name: string; tvl: number }> = []

interface SectionHeaderProps {
	id: string
	children: React.ReactNode
}

function SectionHeader({ id, children }: SectionHeaderProps) {
	return (
		<h2 className="group relative flex items-center gap-1 heading-xs" id={id}>
			{children}
			<a
				aria-hidden="true"
				tabIndex={-1}
				href={`#${id}`}
				className="absolute top-0 right-0 z-10 flex size-full items-center"
			/>
			<Icon name="link" className="invisible size-3.5 group-hover:visible group-focus-visible:visible" />
		</h2>
	)
}

export function AdditionalInfo(props: IProtocolOverviewPageData) {
	const cardsToStackOnLeft =
		(props.fees?.childMethodologies?.length ? 1 : 0) +
		(props.revenue?.childMethodologies?.length ? 1 : 0) +
		(props.holdersRevenue?.childMethodologies?.length ? 1 : 0)

	if (cardsToStackOnLeft === 3) {
		return (
			<div className="col-span-full grid grid-cols-1 gap-2 xl:grid-cols-2">
				<div className="col-span-1 flex flex-col gap-2">
					<ProtocolInfo {...props} />
					<SponsoredResearchReportsCard
						reports={props.articles}
						entityType={props.researchSponsorEntity?.entityType ?? (props.isCEX ? 'cex' : 'protocol')}
						entitySlug={props.researchSponsorEntity?.entitySlug ?? slug(props.name)}
						className="col-span-1"
					/>
					<Yields {...props} />
					<UserActivity users={props.users} gasUsedValueSymbol={props.chartDenominations[1]?.symbol ?? null} />
				</div>
				<Methodology {...props} />
				<Hacks {...props} />
				<Competitors {...props} />
				<NewsletterSignup layout="strip" className="col-span-full" />
			</div>
		)
	}

	return (
		<div className="col-span-full grid grid-cols-1 gap-2 min-[1536px]:grid-cols-3 min-[1792px]:grid-cols-3 xl:grid-cols-2">
			<ProtocolInfo {...props} />
			<SponsoredResearchReportsCard
				reports={props.articles}
				entityType={props.researchSponsorEntity?.entityType ?? (props.isCEX ? 'cex' : 'protocol')}
				entitySlug={props.researchSponsorEntity?.entitySlug ?? slug(props.name)}
				className="col-span-1"
			/>
			<Methodology {...props} />
			<NewsletterSignup layout="strip" className="col-span-full" />
			<Yields {...props} />
			<UserActivity users={props.users} gasUsedValueSymbol={props.chartDenominations[1]?.symbol ?? null} />
			<Hacks {...props} />
			<Competitors {...props} />
		</div>
	)
}

export function UserActivity({
	users,
	gasUsedValueSymbol
}: {
	users: IProtocolOverviewPageData['users']
	gasUsedValueSymbol: string | null
}) {
	if (!users) return null

	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<h2 className="mr-auto heading-xs underline decoration-dotted">
				<Tooltip
					content="This only counts users that interact with protocol directly (so not through another contract, such as a DEX aggregator), and only on arbitrum, avax, bsc, ethereum, xdai, optimism, polygon."
					className="mr-auto cursor-help heading-xs underline decoration-dotted"
					tabIndex={0}
				>
					User Activity
				</Tooltip>
			</h2>
			<div className="flex flex-col">
				{users.activeUsers != null ? (
					<MetricRow
						label="Active Addresses (24h)"
						value={formatCompactNumber(users.activeUsers, {
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					/>
				) : null}
				{users.newUsers != null ? (
					<MetricRow
						label="New Addresses (24h)"
						value={formatCompactNumber(users.newUsers, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
					/>
				) : null}
				{users.transactions != null ? (
					<MetricRow
						label="Transactions (24h)"
						value={formatCompactNumber(users.transactions, {
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					/>
				) : null}
				{users.gasUsed != null ? (
					<MetricRow
						label="Gas Used (24h)"
						value={`${formatCompactNumber(users.gasUsed, {
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}${gasUsedValueSymbol ? ` ${gasUsedValueSymbol}` : ''}`}
					/>
				) : null}
				{users.gasUsedUsd != null ? (
					<MetricRow
						label="Gas Cost (24h)"
						value={formatUsd(users.gasUsedUsd, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					/>
				) : null}
			</div>
		</Card>
	)
}

export function ProtocolInfo(props: IProtocolOverviewPageData) {
	const childProtocols = props.childProtocols ?? []
	const categories = getProtocolInfoCategories(props.category, childProtocols)

	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<SectionHeader id="protocol-information">
				{props.isCEX ? 'Exchange Information' : 'Protocol Information'}
			</SectionHeader>
			{props.description ? <p>{props.description}</p> : null}
			<div className="flex flex-wrap gap-3">
				{props.website ? (
					<ExternalLinkButton
						href={props.website}
						icon="globe"
						data-umami-event="protocol-website-click"
						data-umami-event-protocol={props.name}
						data-umami-event-referral={props.isWebsiteReferral ? 'true' : 'false'}
						data-umami-event-placement="info"
						data-umami-event-url={props.website}
					>
						Website
					</ExternalLinkButton>
				) : null}
				{props.github?.length
					? props.github.map((github) => (
							<ExternalLinkButton
								href={`https://github.com/${github}`}
								icon="github"
								key={`${props.name}-github-${github}`}
							>
								{props.github?.length === 1 ? 'GitHub' : github}
							</ExternalLinkButton>
						))
					: null}
				{props.twitter ? (
					<ExternalLinkButton href={`https://x.com/${props.twitter}`} icon="twitter">
						X/Twitter
					</ExternalLinkButton>
				) : null}
				{props.safeHarbor ? (
					<ExternalLinkButton href={`https://safeharbor.securityalliance.org/database/${slug(props.name)}`}>
						Safe Harbor Agreement
					</ExternalLinkButton>
				) : null}
				{props.exchangeProfileRoute ? (
					<Button as={BasicLink} href={props.exchangeProfileRoute} size="md">
						Exchange profile
					</Button>
				) : null}
			</div>
			{categories.length > 0 ? (
				<div className="flex flex-wrap items-center gap-2">
					<span className="label-md text-secondary">{categories.length > 1 ? 'Categories' : 'Category'}:</span>
					{categories.map((category) => (
						<Button as={BasicLink} href={category.href} size="md" key={`${props.id}-category-${category.label}`}>
							{category.label}
						</Button>
					))}
				</div>
			) : null}
			{props.tags?.length ? <p className="flex items-center gap-1">Sub Category: {props.tags.join(', ')}</p> : null}
			{childProtocols.length > 0 ? (
				<div className="@container flex flex-col gap-2">
					<span className="label-md text-secondary">Products:</span>
					<ul className="grid gap-2 @2xl:grid-cols-2">
						{childProtocols.map((child) => (
							<ChildProtocolRow child={child} key={child.name} />
						))}
					</ul>
				</div>
			) : null}

			{props.audits ? (
				<>
					<p className="flex items-center gap-1">
						<span className="flex flex-nowrap items-center gap-1 label-md text-secondary">
							<span>Audits</span>
							<QuestionHelper text="Audits are not a security guarantee" />
							<span>:</span>
						</span>
						{props.audits.auditLinks.length > 0 ? (
							<Menu name="Yes" options={props.audits.auditLinks} isExternal />
						) : (
							<span>No</span>
						)}
					</p>
					{props.audits.note ? <p>Audit Note: {props.audits.note}</p> : null}
				</>
			) : null}
		</Card>
	)
}

function ChildProtocolRow({ child }: { child: NonNullable<IProtocolOverviewPageData['childProtocols']>[number] }) {
	return (
		<li className="flex items-center gap-2 rounded-lg bg-surface-elevated-1 p-2">
			<TokenLogo name={child.name} kind="token" size={24} alt="" />
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<BasicLink href={child.href} className="truncate label-md text-primary hover:text-link hover:underline">
					{child.name}
				</BasicLink>
				{child.category ? <span className="truncate label-sm text-secondary">{child.category}</span> : null}
			</div>
			{/* Fixed width: IconsRow sizes its overflow from its own measured width, so a shrink-to-fit cell renders nothing. */}
			<div className="w-24 shrink-0">
				<IconsRow items={toChainIconItems(child.chains, (chain) => chainHref('/chain', chain))} align="end" />
			</div>
		</li>
	)
}

function Methodology(props: IProtocolOverviewPageData) {
	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<SectionHeader id="methodology">Methodology</SectionHeader>
			{!props.isOracleProtocol && props.tvlMethodologyUrl ? (
				<a href={props.tvlMethodologyUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
					<span className="font-medium text-secondary">{props.isCEX ? 'Total Assets:' : 'TVL:'}</span>{' '}
					<span>{props.tvlMethodology ?? ''}</span>
					<span className="relative top-0.5 left-1 inline-block">
						<Icon name="external-link" className="size-3.5" />
						<span className="sr-only">View code on GitHub</span>
					</span>
				</a>
			) : !props.isOracleProtocol && props.tvlMethodology ? (
				<p>
					<span className="font-medium text-secondary">{props.isCEX ? 'Total Assets:' : 'TVL:'}</span>{' '}
					<span>{props.tvlMethodology ?? ''}</span>
				</p>
			) : null}
			{props.isOracleProtocol && props.tvlMethodologyUrl ? (
				<a href={props.tvlMethodologyUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
					<span className="font-medium text-secondary">TVS:</span>{' '}
					<span>Total value secured by an oracle, where oracle failure would lead to a loss equal to TVS</span>
					<span className="relative top-0.5 left-1 inline-block">
						<Icon name="external-link" className="size-3.5" />
						<span className="sr-only">View code on GitHub</span>
					</span>
				</a>
			) : props.isOracleProtocol ? (
				<p>
					<span className="font-medium text-secondary">TVS:</span>{' '}
					<span>Total value secured by an oracle, where oracle failure would lead to a loss equal to TVS</span>
				</p>
			) : null}
			<MethodologyByAdapter adapter={props.fees} title="Fees" />
			<MethodologyByAdapter adapter={props.revenue} title="Revenue" />
			<MethodologyByAdapter adapter={props.holdersRevenue} title="Holders Revenue" />
			<MethodologyByAdapter adapter={props.dexVolume} title="DEX Volume" />
			<MethodologyByAdapter adapter={props.dexNotionalVolume} title="Notional Volume" />
			<MethodologyByAdapter adapter={props.dexAggregatorVolume} title="DEX Aggregator Volume" />
			<MethodologyByAdapter adapter={props.perpVolume} title="Perp Volume" />
			<MethodologyByAdapter adapter={props.perpAggregatorVolume} title="Perp Aggregator Volume" />
			<MethodologyByAdapter adapter={props.bridgeAggregatorVolume} title="Bridge Aggregator Volume" />
			<MethodologyByAdapter adapter={props.optionsPremiumVolume} title="Options Premium Volume" />
			<MethodologyByAdapter adapter={props.optionsNotionalVolume} title="Options Notional Volume" />
			<MethodologyByAdapter adapter={props.liquidationVolume} title="Liquidation Volume" />
			<MethodologyByAdapter adapter={props.collateralLiquidated} title="Collateral Liquidated" />
			{props.incentives?.methodology ? (
				<>
					<p>
						<span className="font-medium text-secondary">Incentives:</span> <span>{props.incentives.methodology}</span>
					</p>
					{props.revenue ? (
						<p>
							<span className="font-medium text-secondary">Earnings:</span>{' '}
							<span>Revenue of the protocol minus the incentives distributed to users</span>
						</p>
					) : null}
				</>
			) : null}
			{props.treasuryMethodologyUrl ? (
				<a href={props.treasuryMethodologyUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
					<span className="font-medium text-secondary">Treasury:</span>{' '}
					<span>Value of tokens owned by the protocol</span>
				</a>
			) : null}
		</Card>
	)
}

function MethodologyByAdapter({
	adapter,
	title
}: {
	adapter: IProtocolOverviewPageData['fees'] | null
	title: string
}) {
	if (adapter?.childMethodologies?.length) {
		return (
			<div className="flex flex-col">
				<h3 className="font-medium text-secondary">{title}:</h3>
				<div className="flex flex-col gap-0.5">
					{adapter.childMethodologies.map((child) =>
						child.methodology ? (
							child.methodologyURL ? (
								<a
									key={child.id}
									href={child.methodologyURL}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:underline"
								>
									<span>{child.name} - </span> <span>{child.methodology}</span>
									{child.methodologyURL ? (
										<span className="relative top-0.5 left-1 inline-block">
											<Icon name="external-link" className="size-3.5" />
											<span className="sr-only">View code on GitHub</span>
										</span>
									) : null}
								</a>
							) : (
								<p key={child.id}>
									{child.name}: {child.methodology}
								</p>
							)
						) : null
					)}
				</div>
			</div>
		)
	}

	return (
		<>
			{adapter?.methodology || adapter?.methodologyURL ? (
				adapter?.methodologyURL ? (
					<a href={adapter.methodologyURL} target="_blank" rel="noopener noreferrer" className="hover:underline">
						<span className="font-medium text-secondary">{title}:</span>{' '}
						{adapter.methodology ? <span>{adapter.methodology}</span> : null}
						{adapter.methodologyURL ? (
							<span className="relative top-0.5 left-1 inline-block">
								<Icon name="external-link" className="size-3.5" />
								<span className="sr-only">View code on GitHub</span>
							</span>
						) : null}
					</a>
				) : (
					<p>
						<span className="font-medium text-secondary">{title}:</span> <span>{adapter?.methodology}</span>
					</p>
				)
			) : null}
		</>
	)
}

function Yields(props: IProtocolOverviewPageData) {
	const yields = props.yields
	if (!yields) return null
	const averageApy =
		yields.averageAPY == null
			? '-'
			: `${formatPercent(yields.averageAPY, { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<SectionHeader id="yields">Yields</SectionHeader>
			<div>
				<MetricRow label="Pools Tracked" value={yields.noOfPoolsTracked} />
				<MetricRow label="Average Supply APY" value={averageApy} />
			</div>
			<Button
				as={ButtonLink}
				href={yieldsProtocolsHref(props.otherProtocols ? props.otherProtocols.slice(1) : [props.name])}
				size="md"
				className="mr-auto"
			>
				<span>View all Yields</span>
				<Icon name="arrow-right" className="size-3.5" />
			</Button>
		</Card>
	)
}

export function Hacks(props: Pick<IProtocolOverviewPageData, 'hacks' | 'id' | 'name'>) {
	if (!props.hacks?.length) return null
	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<SectionHeader id="hacks">Hacks</SectionHeader>
			<div className="flex flex-col">
				{props.hacks.map((hack) => (
					<div
						key={`${props.name}-hack-${hack.date}`}
						className="flex flex-col gap-1 border-b border-subtle py-2 first:pt-0 last:border-none last:pb-0"
					>
						{hack.date !== null ? (
							<p>
								<span>Date: </span>
								<span>{formatDate(hack.date, { input: 'seconds' })}</span>
							</p>
						) : null}
						{props.id.startsWith('parent#') ? (
							<p>
								<span>Protocol: </span>
								<span>{hack.name}</span>
							</p>
						) : null}
						{hack.amountUsd !== null ? (
							<p>
								<span>Amount: </span>
								<span>
									{formatUsd(hack.amountUsd, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</span>
							</p>
						) : null}
						{hack.classification ? <p>Classification: {hack.classification}</p> : null}
						{hack.technique ? <p>Technique: {hack.technique}</p> : null}
						{hack.chain?.length ? (
							<p>
								<span>Chains: </span>
								<span>{hack.chain.join(', ')}</span>
							</p>
						) : null}
						{hack.bridgeHack ? <p>Bridge Hack</p> : null}
						{hack.language ? <p>Language: {hack.language}</p> : null}
						{hack.targetType ? (
							<p>
								<span>Target Type: </span>
								<span>{hack.targetType}</span>
							</p>
						) : null}
						{hack.returnedFundsUsd !== null ? (
							<p>
								<span>Returned Funds: </span>
								<span>
									{formatUsd(hack.returnedFundsUsd, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</span>
							</p>
						) : null}
						{hack.source ? (
							<a
								href={hack.source}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1 underline"
							>
								<span>Source</span>
								<Icon name="external-link" className="size-3.5" />
							</a>
						) : null}
					</div>
				))}
			</div>
		</Card>
	)
}

function Competitors(props: IProtocolOverviewPageData) {
	const competitors = props.competitors ?? EMPTY_COMPETITORS
	const subscribeModalStore = Ariakit.useDialogStore()
	const { isAuthenticated, hasActiveSubscription, loaders } = useAuthContext()
	const baseChartForComparison = useMemo(
		() =>
			props.isCEX
				? (props.initialMultiSeriesChartData['Total Assets'] ?? props.initialMultiSeriesChartData['TVL'] ?? [])
				: (props.initialMultiSeriesChartData['TVL'] ?? []),
		[props.initialMultiSeriesChartData, props.isCEX]
	)
	const comparisonHref = useMemo(() => {
		const latestTvl = baseChartForComparison[baseChartForComparison.length - 1]?.[1]
		const entries = [
			{
				slug: slug(props.name),
				tvl: typeof latestTvl === 'number' ? latestTvl : 0
			},
			...competitors.map((similarProtocol) => ({
				slug: slug(similarProtocol.name),
				tvl: typeof similarProtocol.tvl === 'number' ? similarProtocol.tvl : 0
			}))
		]
		const bySlug = new Map<string, number>()
		for (const entry of entries) {
			const prev = bySlug.get(entry.slug)
			if (prev === undefined || entry.tvl > prev) {
				bySlug.set(entry.slug, entry.tvl)
			}
		}
		const slugs = Array.from(bySlug, ([itemSlug, tvl]) => ({ slug: itemSlug, tvl }))
			.sort((a, b) => b.tvl - a.tvl)
			.slice(0, 10)
			.map((item) => item.slug)
		if (slugs.length === 0) return null
		const params = new URLSearchParams({
			comparison: 'protocols',
			items: slugs.join(','),
			step: 'select-metrics'
		})
		return `/pro?${params.toString()}`
	}, [baseChartForComparison, competitors, props.name])
	const canOpenComparison = !loaders.userLoading && isAuthenticated && hasActiveSubscription
	if (competitors.length === 0) return null
	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<div className="flex items-center justify-between gap-2">
				<SectionHeader id="competitors">Competitors</SectionHeader>
				{comparisonHref ? (
					<Button
						as={ButtonLink}
						href={comparisonHref}
						size="md"
						onClick={(event) => {
							if (canOpenComparison) return
							event.preventDefault()
							setSignupSource('protocol-comparison')
							subscribeModalStore.show()
						}}
					>
						Create comparison dashboard
					</Button>
				) : null}
			</div>
			<div className="flex flex-wrap items-center gap-4">
				{competitors.map((similarProtocol) => (
					<a
						href={`/protocol/${slug(similarProtocol.name)}`}
						key={`${props.name}-competitors-${similarProtocol.name}`}
						target="_blank"
						rel="noopener noreferrer"
						className="underline"
					>{`${similarProtocol.name}${similarProtocol.tvl ? ` (${formatUsd(similarProtocol.tvl, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })})` : ''}`}</a>
				))}
			</div>
			<LazySubscribeProModal dialogStore={subscribeModalStore} />
		</Card>
	)
}
