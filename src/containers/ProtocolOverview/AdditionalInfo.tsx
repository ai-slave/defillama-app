import * as Ariakit from '@ariakit/react'
import dayjs from 'dayjs'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink, ButtonLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { getCategoryRoute } from '~/containers/ProtocolTaxonomy/categoryRoutes'
import { buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { MetricRow } from '~/ui/MetricPrimitives'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Tooltip } from '~/ui/Tooltip'
import { formattedNum, slug } from '~/utils'
import type { IProtocolOverviewPageData } from './types'

const EMPTY_COMPETITORS: Array<{ name: string; tvl: number }> = []
const INFO_ACTION_STYLES = buttonStyles({ size: 'md' })

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((module) => ({
		default: module.SubscribeProModal
	}))
)

interface SectionHeaderProps {
	id: string
	children: React.ReactNode
}

const SectionHeader = ({ id, children }: SectionHeaderProps) => (
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

export const AdditionalInfo = (props: IProtocolOverviewPageData) => {
	const cardsToStackOnLeft =
		(props.fees?.childMethodologies?.length ? 1 : 0) +
		(props.revenue?.childMethodologies?.length ? 1 : 0) +
		(props.holdersRevenue?.childMethodologies?.length ? 1 : 0)

	if (cardsToStackOnLeft === 3) {
		return (
			<div className="col-span-full grid grid-cols-1 gap-2 xl:grid-cols-2">
				<div className="col-span-1 flex flex-col gap-2">
					<ProtocolInfo {...props} />
					<Articles {...props} />
					<Yields {...props} />
					<Users {...props} />
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
			<Articles {...props} />
			<Methodology {...props} />
			<NewsletterSignup layout="strip" className="col-span-full" />
			<Yields {...props} />
			<Users {...props} />
			<Hacks {...props} />
			<Competitors {...props} />
		</div>
	)
}

const Articles = (props: IProtocolOverviewPageData) => {
	if (!props.articles?.length) return null

	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<div className="flex items-center justify-between gap-3">
				<SectionHeader id="research">Latest from DefiLlama Research</SectionHeader>
				<BasicLink href="/research" className="shrink-0">
					<span className="relative block h-6 w-[76px]">
						<img
							src="/assets/research_logo_dark.webp"
							width={76}
							height={24}
							className="invisible absolute inset-0 object-contain object-right dark:visible"
							alt=""
						/>
						<img
							src="/assets/research_logo.webp"
							width={76}
							height={24}
							className="visible absolute inset-0 object-contain object-right dark:invisible"
							alt=""
						/>
					</span>
					<span className="sr-only">Visit DefiLlama Research</span>
				</BasicLink>
			</div>

			{props.articles.map((article) => (
				<BasicLink
					key={`research_card_${article.href}`}
					href={article.href}
					className="hover-wash flex flex-col gap-3 rounded-md border border-subtle bg-surface p-2"
				>
					{article.imgSrc ? (
						<img
							className="h-[100px] w-full shrink-0 rounded-md object-cover"
							src={article.imgSrc}
							alt={article.headline}
						/>
					) : null}
					<div className="flex flex-col justify-between gap-3">
						<p className="label-md break-keep whitespace-pre-wrap text-primary">{article.headline}</p>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
							<p className="label-sm text-tertiary">{dayjs.utc(article.date).format('MMMM D, YYYY')}</p>
							<p className="flex flex-nowrap items-center justify-between gap-1 label-sm text-primary">
								<span>Read report</span> <Icon name="arrow-up-right" height={14} width={14} />
							</p>
						</div>
					</div>
				</BasicLink>
			))}
		</Card>
	)
}

function Users(props: IProtocolOverviewPageData) {
	const users = props.users
	if (!users) return null

	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<h2 className="mr-auto heading-xs underline decoration-dotted">
				<Tooltip
					content="This only counts users that interact with protocol directly (so not through another contract, such as a DEX aggregator), and only on arbitrum, avax, bsc, ethereum, xdai, optimism, polygon."
					className="mr-auto heading-xs underline decoration-dotted"
				>
					User Activity
				</Tooltip>
			</h2>
			<div className="flex flex-col">
				{users.activeUsers != null ? (
					<MetricRow label="Active Addresses (24h)" value={formattedNum(users.activeUsers, false)} />
				) : null}
				{users.newUsers != null ? (
					<MetricRow label="New Addresses (24h)" value={formattedNum(users.newUsers, false)} />
				) : null}
				{users.transactions != null ? (
					<MetricRow label="Transactions (24h)" value={formattedNum(users.transactions, false)} />
				) : null}
				{users.gasUsd != null ? <MetricRow label="Gas Used (24h)" value={formattedNum(users.gasUsd, true)} /> : null}
			</div>
		</Card>
	)
}

export const ProtocolInfo = (props: IProtocolOverviewPageData) => {
	const categoryHref = props.category ? getCategoryRoute(slug(props.category)) : null

	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<SectionHeader id="protocol-information">
				{props.isCEX ? 'Exchange Information' : 'Protocol Information'}
			</SectionHeader>
			{props.description ? <p>{props.description}</p> : null}
			{props.category && categoryHref ? (
				<p className="flex flex-wrap items-center gap-2">
					<span className="label-md text-secondary">Category:</span>
					<BasicLink href={categoryHref} className={INFO_ACTION_STYLES}>
						{props.category}
						<Icon name="arrow-up-right" className="size-3.5" />
					</BasicLink>
				</p>
			) : null}
			{props.tags?.length ? <p className="flex items-center gap-1">Sub Category: {props.tags.join(', ')}</p> : null}

			{props.audits ? (
				<>
					<p className="flex items-center gap-1">
						<span className="flex flex-nowrap items-center gap-1 label-md text-secondary">
							<span>Audits</span>
							<QuestionHelper text="Audits are not a security guarantee" />
							<span>:</span>
						</span>
						{props.audits.auditLinks.length > 0 ? (
							<Menu name="Yes" options={props.audits.auditLinks} isExternal className={INFO_ACTION_STYLES} />
						) : (
							<span>No</span>
						)}
					</p>
					{props.audits.note ? <p>Audit Note: {props.audits.note}</p> : null}
				</>
			) : null}
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
						Twitter
					</ExternalLinkButton>
				) : null}
				{props.safeHarbor ? (
					<ExternalLinkButton href={`https://safeharbor.securityalliance.org/database/${slug(props.name)}`}>
						Safe Harbor Agreement
					</ExternalLinkButton>
				) : null}
			</div>
		</Card>
	)
}

const Methodology = (props: IProtocolOverviewPageData) => {
	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<SectionHeader id="methodology">Methodology</SectionHeader>
			{!props.oracleTvs && props.tvlMethodologyUrl ? (
				<a href={props.tvlMethodologyUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
					<span className="font-medium text-secondary">{props.isCEX ? 'Total Assets:' : 'TVL:'}</span>{' '}
					<span>{props.tvlMethodology ?? ''}</span>
					<span className="relative top-0.5 left-1 inline-block">
						<Icon name="external-link" className="size-3.5" />
						<span className="sr-only">View code on GitHub</span>
					</span>
				</a>
			) : !props.oracleTvs && props.tvlMethodology ? (
				<p>
					<span className="font-medium text-secondary">{props.isCEX ? 'Total Assets:' : 'TVL:'}</span>{' '}
					<span>{props.tvlMethodology ?? ''}</span>
				</p>
			) : null}
			{props.oracleTvs && props.tvlMethodologyUrl ? (
				<a href={props.tvlMethodologyUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
					<span className="font-medium text-secondary">TVS:</span>{' '}
					<span>Total value secured by an oracle, where oracle failure would lead to a loss equal to TVS</span>
					<span className="relative top-0.5 left-1 inline-block">
						<Icon name="external-link" className="size-3.5" />
						<span className="sr-only">View code on GitHub</span>
					</span>
				</a>
			) : props.oracleTvs ? (
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

const MethodologyByAdapter = ({
	adapter,
	title
}: {
	adapter: IProtocolOverviewPageData['fees'] | null
	title: string
}) => {
	if (adapter?.childMethodologies?.length) {
		return (
			<div className="flex flex-col">
				<h3 className="font-medium text-secondary">{title}:</h3>
				<div className="flex flex-col gap-0.5">
					{adapter.childMethodologies.map((child) =>
						child[1] ? (
							child[2] ? (
								<a
									key={`${title}-${child[0]}-${child[1] ?? ''}-${child[2] ?? ''}`}
									href={child[2]}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:underline"
								>
									<span>{child[0]} - </span> <span>{child[1]}</span>
									{child[2] ? (
										<span className="relative top-0.5 left-1 inline-block">
											<Icon name="external-link" className="size-3.5" />
											<span className="sr-only">View code on GitHub</span>
										</span>
									) : null}
								</a>
							) : (
								<p key={`${title}-${child[0]}-${child[1] ?? ''}`}>
									{child[0]}: {child[1]}
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
	const averageApy = yields.averageAPY == null ? '-' : `${formattedNum(yields.averageAPY, false)}%`
	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<SectionHeader id="yields">Yields</SectionHeader>
			<div>
				<MetricRow label="Pools Tracked" value={yields.noOfPoolsTracked} />
				<MetricRow label="Average Supply APY" value={averageApy} />
			</div>
			<ButtonLink
				href={`/yields?project=${props.otherProtocols ? props.otherProtocols.slice(1).join('&project=') : props.name}`}
				className={`${INFO_ACTION_STYLES} mr-auto`}
			>
				<span>View all Yields</span>
				<Icon name="arrow-right" className="size-4" />
			</ButtonLink>
		</Card>
	)
}

const Hacks = (props: IProtocolOverviewPageData) => {
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
						{hack.date ? (
							<p>
								<span>Date: </span>
								<span>{dayjs.utc(hack.date * 1e3).format('MMM D, YYYY')}</span>
							</p>
						) : null}
						{props.id.startsWith('parent#') ? (
							<p>
								<span>Protocol: </span>
								<span>{hack.name}</span>
							</p>
						) : null}
						{hack.amount ? (
							<p>
								<span>Amount: </span>
								<span>{formattedNum(hack.amount, true)}</span>
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
						{hack.returnedFunds ? (
							<p>
								<span>Returned Funds: </span>
								<span>{formattedNum(hack.returnedFunds, true)}</span>
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

const Competitors = (props: IProtocolOverviewPageData) => {
	const competitors = props.competitors ?? EMPTY_COMPETITORS
	const [shouldRenderModal, setShouldRenderModal] = useState(false)
	const subscribeModalStore = Ariakit.useDialogStore({ open: shouldRenderModal, setOpen: setShouldRenderModal })
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
					<ButtonLink
						href={comparisonHref}
						onClick={(event) => {
							if (canOpenComparison) return
							event.preventDefault()
							setSignupSource('protocol-comparison')
							subscribeModalStore.show()
						}}
						className={INFO_ACTION_STYLES}
					>
						Create comparison dashboard
					</ButtonLink>
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
					>{`${similarProtocol.name}${similarProtocol.tvl ? ` (${formattedNum(similarProtocol.tvl, true)})` : ''}`}</a>
				))}
			</div>
			{shouldRenderModal ? (
				<Suspense fallback={<></>}>
					<SubscribeProModal dialogStore={subscribeModalStore} />
				</Suspense>
			) : null}
		</Card>
	)
}
