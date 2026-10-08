import * as Ariakit from '@ariakit/react'
import Image from 'next/image'
import { useMemo, type ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { CardLikeButton } from '~/containers/ProDashboard/components/CardLikeButton'
import { DashboardPreview } from '~/containers/ProDashboard/components/DashboardPreview'
import { buildDashboardPreview } from '~/containers/ProDashboard/components/dashboardPreview.utils'
import { Icon } from '~/ui/Icon'
import type { IIcon } from '~/ui/Icon'
import { RelativeTime } from '~/ui/RelativeTime'
import { formatNumber } from '~/utils/numberFormat'
import { avatarColorStyle } from './avatarColor'
import { FollowAuthorButton } from './FollowAuthorButton'
import { ShareProfileButton } from './ShareProfileButton'
import type {
	AuthorDashboardSort,
	AuthorDashboardSummary,
	AuthorPageResponse,
	AuthorStats,
	PublicDashboardAuthor
} from './types'

const SORT_OPTIONS: Array<{ value: AuthorDashboardSort; label: string }> = [
	{ value: 'recent', label: 'Recent' },
	{ value: 'popular', label: 'Popular' },
	{ value: 'likes', label: 'Most liked' }
]

type NavParams = { page?: number; sort?: AuthorDashboardSort }

type AuthorProfileNav = {
	hrefFor?: (params: NavParams) => string
	navigate?: (params: NavParams) => void
}

export function compactText(value: string | null | undefined, fallback = ''): string {
	if (typeof value !== 'string') return fallback
	return value.replace(/\s+/g, ' ').trim() || fallback
}

function dashboardName(dashboard: AuthorDashboardSummary): string {
	return compactText(dashboard.data?.dashboardName, 'Untitled Dashboard')
}

function dashboardDescription(dashboard: AuthorDashboardSummary): string {
	return compactText(dashboard.description, 'Community-built DefiLlama Pro dashboard.')
}

function dashboardItemCount(dashboard: AuthorDashboardSummary): number {
	return Array.isArray(dashboard.data?.items) ? dashboard.data.items.length : 0
}

function dashboardUpdatedAt(dashboard: AuthorDashboardSummary): string | null {
	return dashboard.editedAt || dashboard.updated || dashboard.created || null
}

export function fallbackAuthorStats(dashboards: Array<AuthorDashboardSummary>): AuthorStats {
	let totalViews = 0
	let totalLikes = 0
	for (const dashboard of dashboards) {
		totalViews += dashboard.viewCount ?? 0
		totalLikes += dashboard.likeCount ?? 0
	}
	return { totalViews, totalLikes, followerCount: 0 }
}

function mostViewedDashboard(dashboards: Array<AuthorDashboardSummary>): AuthorDashboardSummary | null {
	let top: AuthorDashboardSummary | null = null
	for (const dashboard of dashboards) {
		if (!top || (dashboard.viewCount ?? 0) > (top.viewCount ?? 0)) top = dashboard
	}
	return top
}

function socialLabel(key: string): string {
	switch (key) {
		case 'twitter':
		case 'x':
			return 'X/Twitter'
		case 'github':
			return 'GitHub'
		case 'farcaster':
		case 'warpcast':
			return 'Farcaster'
		case 'bluesky':
			return 'Bluesky'
		case 'mastodon':
			return 'Mastodon'
		case 'telegram':
			return 'Telegram'
		case 'discord':
			return 'Discord'
		case 'linkedin':
			return 'LinkedIn'
		case 'website':
			return 'Website'
		default:
			return key.replace(/[-_]/g, ' ')
	}
}

function socialIconName(key: string): IIcon['name'] {
	switch (key) {
		case 'twitter':
		case 'x':
			return 'twitter'
		case 'github':
			return 'github'
		case 'telegram':
			return 'telegram'
		case 'discord':
			return 'discord'
		case 'linkedin':
			return 'linkedin'
		case 'farcaster':
		case 'warpcast':
			return 'farcaster'
		case 'bluesky':
			return 'bluesky'
		case 'mastodon':
			return 'mastodon'
		case 'website':
			return 'globe'
		default:
			return 'link'
	}
}

function isSafeHttpsUrl(value: string): boolean {
	try {
		const url = new URL(value)
		return url.protocol === 'https:' && !url.username && !url.password
	} catch {
		return false
	}
}

export function socialEntries(author: PublicDashboardAuthor): Array<[string, string]> {
	return Object.entries(author.socials || {}).filter(([, value]) => typeof value === 'string' && isSafeHttpsUrl(value))
}

function NavLink({
	params,
	nav,
	className,
	ariaCurrent,
	ariaDisabled,
	children
}: {
	params: NavParams
	nav: AuthorProfileNav
	className: string
	ariaCurrent?: 'page'
	ariaDisabled?: boolean
	children: ReactNode
}) {
	if (nav.navigate) {
		return (
			<Ariakit.Button
				type="button"
				onClick={() => nav.navigate!(params)}
				aria-current={ariaCurrent}
				disabled={ariaDisabled}
				accessibleWhenDisabled
				className={className}
			>
				{children}
			</Ariakit.Button>
		)
	}
	return (
		<BasicLink
			href={nav.hrefFor ? nav.hrefFor(params) : '#'}
			aria-current={ariaCurrent}
			aria-disabled={ariaDisabled}
			className={className}
		>
			{children}
		</BasicLink>
	)
}

function Avatar({ author, size = 'large' }: { author: PublicDashboardAuthor; size?: 'small' | 'large' }) {
	const className =
		size === 'small'
			? 'size-8 rounded-full border border-medium object-cover'
			: 'size-24 rounded-full border border-medium object-cover md:size-28'
	const fallbackClassName =
		size === 'small'
			? 'flex size-8 items-center justify-center rounded-full border border-medium text-lg'
			: 'flex size-24 items-center justify-center rounded-full border border-medium text-5xl md:size-28'

	if (author.avatarUrl && isSafeHttpsUrl(author.avatarUrl)) {
		return <Image src={author.avatarUrl} alt="" width={112} height={112} unoptimized className={className} />
	}
	return (
		<div className={fallbackClassName} style={avatarColorStyle(author.slug)}>
			🦙
		</div>
	)
}

function AuthorDashboardPreview({ dashboard, className }: { dashboard: AuthorDashboardSummary; className?: string }) {
	const tiles = useMemo(() => buildDashboardPreview(dashboard.data?.items ?? []), [dashboard.data?.items])
	return <DashboardPreview tiles={tiles} {...(className === undefined ? {} : { className })} />
}

function DashboardCardStats({ dashboard }: { dashboard: AuthorDashboardSummary }) {
	const itemsCount = dashboardItemCount(dashboard)
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 body-sm text-tertiary">
			<span>
				{formatNumber(itemsCount)} {itemsCount === 1 ? 'item' : 'items'}
			</span>
			<span className="inline-flex items-center gap-1">
				<Icon name="eye" className="size-3.5" />
				{formatNumber(dashboard.viewCount ?? 0)}
			</span>
			<CardLikeButton dashboardId={dashboard.id} liked={dashboard.liked} likeCount={dashboard.likeCount} />
		</div>
	)
}

function DashboardCard({ dashboard }: { dashboard: AuthorDashboardSummary }) {
	const tags = Array.isArray(dashboard.tags) ? dashboard.tags.filter(Boolean).slice(0, 4) : []
	return (
		<div className="group relative isolate grid min-h-[240px] grid-rows-[auto_1fr] overflow-hidden rounded-md border border-medium bg-surface transition-colors focus-within:border-link hover:border-link/50">
			<div className="absolute inset-x-0 top-0 z-10 h-1 bg-link/70 opacity-0 transition-opacity group-hover:opacity-100" />
			<AuthorDashboardPreview dashboard={dashboard} className="border-b border-pro-cards-border" />
			<div className="grid h-full grid-rows-[auto_1fr_auto] gap-4 p-4">
				<div className="flex items-start justify-between gap-3">
					<h2 className="line-clamp-2 text-lg leading-tight font-semibold text-primary group-hover:text-link">
						{dashboardName(dashboard)}
					</h2>
					<span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-medium text-tertiary transition-colors group-hover:border-link/40 group-hover:text-link">
						<Icon name="arrow-up-right" className="size-4" />
					</span>
				</div>

				<div className="grid content-start gap-3">
					<p className="line-clamp-4 body-md text-secondary">{dashboardDescription(dashboard)}</p>

					{tags.length > 0 ? (
						<ul className="flex flex-wrap gap-1.5" aria-label="Dashboard tags">
							{tags.map((tag) => (
								<li key={tag} className="rounded-md border border-medium bg-page px-2 py-1 body-sm text-secondary">
									{tag}
								</li>
							))}
						</ul>
					) : null}
				</div>

				<div className="grid gap-3 border-t border-medium pt-3">
					<p className="body-sm text-tertiary">
						<RelativeTime value={dashboardUpdatedAt(dashboard)} prefix="Updated" fallback="Unknown" />
					</p>
					<DashboardCardStats dashboard={dashboard} />
				</div>
			</div>
			<BasicLink href={`/pro/${dashboard.slug || dashboard.id}`} className="absolute inset-0">
				<span className="sr-only">{dashboardName(dashboard)}</span>
			</BasicLink>
		</div>
	)
}

function FeaturedDashboardCard({ dashboard }: { dashboard: AuthorDashboardSummary }) {
	const tags = Array.isArray(dashboard.tags) ? dashboard.tags.filter(Boolean).slice(0, 6) : []
	return (
		<section className="group relative isolate overflow-hidden rounded-md border border-medium bg-surface transition-colors hover:border-link/50">
			<div className="absolute inset-x-0 top-0 h-1 bg-link/70" />
			<div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:p-7">
				<div className="grid content-start gap-3">
					<p className="label-xs tracking-[0.2em] text-link uppercase">Featured dashboard</p>
					<h2 className="max-w-3xl text-2xl leading-tight font-semibold text-primary group-hover:text-link md:text-3xl">
						{dashboardName(dashboard)}
					</h2>
					<p className="line-clamp-3 max-w-3xl body-md text-secondary">{dashboardDescription(dashboard)}</p>
					{tags.length > 0 ? (
						<ul className="flex flex-wrap gap-1.5" aria-label="Dashboard tags">
							{tags.map((tag) => (
								<li key={tag} className="rounded-md border border-medium bg-page px-2 py-1 body-sm text-secondary">
									{tag}
								</li>
							))}
						</ul>
					) : null}
				</div>
				<div className="grid content-between gap-4 border-t border-medium pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
					<AuthorDashboardPreview dashboard={dashboard} className="rounded-md border border-pro-cards-border" />
					<DashboardCardStats dashboard={dashboard} />
					<div className="grid gap-2">
						<p className="body-sm text-tertiary">
							<RelativeTime value={dashboardUpdatedAt(dashboard)} prefix="Updated" fallback="Unknown" />
						</p>
						<span className="inline-flex items-center gap-1.5 label-md text-link">
							Open dashboard
							<Icon name="arrow-up-right" className="size-4" />
						</span>
					</div>
				</div>
			</div>
			<BasicLink href={`/pro/${dashboard.slug || dashboard.id}`} className="absolute inset-0">
				<span className="sr-only">{dashboardName(dashboard)}</span>
			</BasicLink>
		</section>
	)
}

function AuthorStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid gap-1 border-t border-medium pt-3">
			<span className="label-xs tracking-[0.18em] text-tertiary uppercase">{label}</span>
			<span className="label-md text-primary">{value}</span>
		</div>
	)
}

function AuthorHero({
	author,
	stats,
	totalDashboards,
	following,
	isOwnProfile,
	socials
}: {
	author: PublicDashboardAuthor
	stats: AuthorStats
	totalDashboards: number
	following?: boolean
	isOwnProfile: boolean
	socials: Array<[string, string]>
}) {
	const dashboardNoun = totalDashboards === 1 ? 'dashboard' : 'dashboards'

	return (
		<header className="relative isolate overflow-hidden rounded-md border border-medium bg-surface">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 opacity-[0.18]"
				style={{
					backgroundImage:
						'linear-gradient(var(--border-medium) 1px, transparent 1px), linear-gradient(90deg, var(--border-medium) 1px, transparent 1px)',
					backgroundSize: '32px 32px'
				}}
			/>
			<div className="relative grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
				<div className="grid gap-6 p-5 sm:p-6 lg:p-8">
					<div className="flex flex-wrap items-center gap-3">
						<span className="rounded-md border border-link/25 bg-research-tint px-2.5 py-1 label-xs tracking-[0.2em] text-link uppercase">
							Dashboard author
						</span>
						<span className="body-md text-tertiary">@{author.slug}</span>
					</div>

					<div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-end">
						<Avatar author={author} />
						<div className="min-w-0">
							<h1 className="max-w-4xl text-[clamp(2rem,1.2rem+3vw,4.75rem)] leading-[0.95] font-semibold text-primary">
								{author.displayName}
							</h1>
							<p className="mt-4 max-w-2xl body-lg text-secondary">
								{author.bio || `${author.displayName} publishes public DefiLlama Pro dashboards for the community.`}
							</p>
						</div>
					</div>

					<div className="flex min-h-8 flex-wrap items-center gap-2">
						{isOwnProfile ? (
							<BasicLink
								href="/account?tab=profile"
								className="inline-flex items-center gap-1.5 rounded-md border border-link/30 bg-research-tint px-3 py-2 label-sm text-link transition-colors hover:border-link/60 hover:bg-research-tint-hover"
							>
								<Icon name="settings" className="size-3.5" />
								Edit profile
							</BasicLink>
						) : null}
						<FollowAuthorButton slug={author.slug} following={following} isOwnProfile={isOwnProfile} />
						<ShareProfileButton slug={author.slug} displayName={author.displayName} />
						{socials.map(([key, value]) => (
							<a
								key={key}
								href={value}
								target="_blank"
								rel="noreferrer noopener"
								className="inline-flex items-center gap-1.5 rounded-md border border-medium bg-page px-3 py-2 label-sm text-secondary transition-colors hover:border-link/50 hover:text-link"
								{...(key === 'website'
									? {
											'data-umami-event': 'author-website-click',
											'data-umami-event-author': author.displayName,
											'data-umami-event-placement': 'info',
											'data-umami-event-url': value
										}
									: {})}
							>
								<Icon name={socialIconName(key)} className="size-3.5" />
								{socialLabel(key)}
							</a>
						))}
					</div>
				</div>

				<aside className="grid content-between gap-6 border-t border-medium bg-page/60 p-5 sm:p-6 lg:border-t-0 lg:border-l lg:p-8">
					<div className="grid gap-2">
						<p className="label-xs tracking-[0.22em] text-tertiary uppercase">Published dashboards</p>
						<div className="flex items-end gap-3">
							<span className="text-5xl leading-none font-semibold text-primary">{formatNumber(totalDashboards)}</span>
							<span className="pb-1 body-md text-secondary">
								public {dashboardNoun}
								<br />
								live on DefiLlama Pro
							</span>
						</div>
					</div>
					<div className="grid gap-4">
						<div className="grid grid-cols-2 gap-4">
							<AuthorStat label="Total views" value={formatNumber(stats.totalViews)} />
							<AuthorStat label="Total likes" value={formatNumber(stats.totalLikes)} />
						</div>
						<AuthorStat label="Followers" value={formatNumber(stats.followerCount)} />
					</div>
				</aside>
			</div>
		</header>
	)
}

function SortControl({ sort, nav }: { sort: AuthorDashboardSort; nav: AuthorProfileNav }) {
	return (
		<nav
			className="flex items-center gap-1 rounded-md border border-medium bg-surface p-0.5"
			aria-label="Sort dashboards"
		>
			{SORT_OPTIONS.map((option) => (
				<NavLink
					key={option.value}
					params={{ sort: option.value }}
					nav={nav}
					ariaCurrent={sort === option.value ? 'page' : undefined}
					className={`rounded-sm px-2.5 py-1.5 label-sm transition-colors ${
						sort === option.value ? 'bg-research-tint text-link' : 'text-secondary hover:text-primary'
					}`}
				>
					{option.label}
				</NavLink>
			))}
		</nav>
	)
}

function EmptyDashboards({ isOwnProfile }: { isOwnProfile: boolean }) {
	if (isOwnProfile) {
		return (
			<div className="grid justify-items-start gap-3 rounded-md border border-dashed border-medium bg-surface p-8">
				<p className="title-lg text-primary">Your profile is live, but it has no dashboards yet</p>
				<p className="max-w-lg body-md text-tertiary">
					Build a dashboard and make it public to start collecting views, likes, and followers here.
				</p>
				<BasicLink href="/pro" className="rounded-md bg-link px-4 py-2 label-md text-on-brand">
					Create your first dashboard
				</BasicLink>
			</div>
		)
	}
	return (
		<div className="grid gap-2 rounded-md border border-dashed border-medium bg-surface p-8">
			<p className="title-lg text-primary">No public dashboards yet</p>
			<p className="max-w-lg body-md text-tertiary">
				When this author publishes a dashboard, it will appear here with its tags, activity, and latest update.
			</p>
		</div>
	)
}

function Pagination({
	page,
	totalPages,
	sort,
	nav
}: {
	page: number
	totalPages: number
	sort: AuthorDashboardSort
	nav: AuthorProfileNav
}) {
	if (totalPages <= 1) return null
	const prev = Math.max(1, page - 1)
	const next = Math.min(totalPages, page + 1)
	return (
		<nav className="flex items-center justify-between gap-3 border-t border-medium pt-5" aria-label="Dashboard pages">
			<NavLink
				params={{ page: prev, sort }}
				nav={nav}
				ariaDisabled={page <= 1}
				className={`rounded-md border border-medium px-3 py-2 body-md ${
					page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-research-tint-hover'
				}`}
			>
				Previous
			</NavLink>
			<span className="body-md text-tertiary">
				Page {page} of {totalPages}
			</span>
			<NavLink
				params={{ page: page >= totalPages ? page : next, sort }}
				nav={nav}
				ariaDisabled={page >= totalPages}
				className={`rounded-md border border-medium px-3 py-2 body-md ${
					page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-research-tint-hover'
				}`}
			>
				Next
			</NavLink>
		</nav>
	)
}

export function AuthorProfileView({
	view,
	sort,
	isOwnProfile,
	hrefFor,
	navigate
}: {
	view: AuthorPageResponse
	sort: AuthorDashboardSort
	isOwnProfile: boolean
	hrefFor?: (params: NavParams) => string
	navigate?: (params: NavParams) => void
}) {
	const { author, dashboards } = view
	const stats = view.stats ?? fallbackAuthorStats(dashboards.items)
	const socials = socialEntries(author)
	const featured =
		view.featured ??
		(dashboards.page === 1 && dashboards.items.length > 0 ? mostViewedDashboard(dashboards.items) : null)
	const showFeatured = dashboards.page === 1 && !!featured
	const gridItems = showFeatured
		? dashboards.items.filter((dashboard) => dashboard.id !== featured.id)
		: dashboards.items
	const nav: AuthorProfileNav = { hrefFor, navigate }

	return (
		<>
			<AuthorHero
				author={author}
				stats={stats}
				totalDashboards={dashboards.totalItems}
				following={view.viewer?.following}
				isOwnProfile={isOwnProfile}
				socials={socials}
			/>
			{showFeatured ? <FeaturedDashboardCard dashboard={featured} /> : null}
			<section className="grid gap-5">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<p className="label-xs tracking-[0.2em] text-tertiary uppercase">Published dashboards</p>
						<h2 className="mt-1 text-2xl leading-tight font-semibold text-primary">Public dashboard library</h2>
					</div>
					<SortControl sort={sort} nav={nav} />
				</div>

				{gridItems.length > 0 ? (
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{gridItems.map((dashboard) => (
							<DashboardCard key={dashboard.id} dashboard={dashboard} />
						))}
					</div>
				) : (
					<EmptyDashboards isOwnProfile={isOwnProfile} />
				)}

				<Pagination page={dashboards.page} totalPages={dashboards.totalPages} sort={sort} nav={nav} />
			</section>
		</>
	)
}
