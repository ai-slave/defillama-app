import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Change } from '~/ui/Change'
import { Hovercard } from '~/ui/Hovercard'
import { Skeleton } from '~/ui/Skeleton'
import { Tag } from '~/ui/Tag'
import { formatDate } from '~/utils/dateFormat'
import { chainIconUrl, peggedAssetIconUrl, tokenIconUrl } from '~/utils/icons'
import { formatNumber, formatUsd, formatPercent } from '~/utils/numberFormat'
import type { EntityPreview } from '../entityPreviewTypes'
import { isPreviewableEntityType } from '../entityPreviewTypes'
import type { ArticleEntityRef, ArticleEntityType } from '../types'

const TYPE_LABEL: Record<ArticleEntityType, string> = {
	protocol: 'Protocol',
	chain: 'Chain',
	stablecoin: 'Stablecoin',
	metric: 'Page',
	hack: 'Hack',
	category: 'Category',
	cex: 'Exchange',
	bridge: 'Bridge'
}

const TYPE_HINT: Record<ArticleEntityType, string> = {
	protocol: 'Protocol overview — TVL, fees, revenue, and activity.',
	chain: 'Chain overview — TVL, protocols, and activity.',
	stablecoin: 'Stablecoin supply, backing, and chain breakdown.',
	metric: 'DefiLlama listing and rankings page.',
	hack: 'Incident detail — loss size and attack vector.',
	category: 'Category overview and member protocols.',
	cex: 'Centralized exchange transparency and reserves.',
	bridge: 'Bridge volume, routes, and source/destination flow.'
}

function entityLogoUrl(entity: ArticleEntityRef) {
	if (entity.entityType === 'chain') return chainIconUrl(entity.slug)
	if (entity.entityType === 'stablecoin') return peggedAssetIconUrl(entity.slug)
	if (entity.entityType === 'protocol') return tokenIconUrl(entity.slug)
	return null
}

function fetchEntityPreview(
	type: ArticleEntityType,
	slug: string,
	signal?: AbortSignal
): Promise<EntityPreview | null> {
	const url = `/api/public/research/entities/preview?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}`
	return fetch(url, { signal })
		.then((r) => (r.ok ? r.json() : null))
		.then((j) => (j && typeof j === 'object' ? ((j.preview as EntityPreview | null) ?? null) : null))
		.catch(() => null)
}

/** One window of the TVL or supply change; the preview sends it as a fraction. */
function ChangeChip({ value, comparison }: { value?: number | null; comparison: string }) {
	if (value == null) return null
	return (
		<span className="inline-flex items-baseline gap-1 text-tertiary">
			<span className="label-xs tabular-nums">
				<Change value={value * 100} />
			</span>
			<span className="body-xs">{comparison}</span>
		</span>
	)
}

function MetricRow({ label, value }: { label: string; value: ReactNode }) {
	return (
		<span className="flex items-baseline justify-between gap-3">
			<span className="body-xs tracking-wider text-tertiary uppercase">{label}</span>
			<span className="body-sm text-primary tabular-nums">{value}</span>
		</span>
	)
}

function PreviewBody({
	entity,
	preview,
	loading
}: {
	entity: ArticleEntityRef
	preview: EntityPreview | null
	loading: boolean
}) {
	if (loading && !preview) {
		return (
			<span className="block pb-3">
				<Skeleton className="h-3 w-2/3" />
				<Skeleton className="mt-2 h-3 w-1/2" />
			</span>
		)
	}
	if (!preview) {
		return (
			<span className="block pb-3 body-sm text-secondary">
				{TYPE_HINT[entity.entityType] ?? 'Open the linked DefiLlama page.'}
			</span>
		)
	}
	switch (preview.kind) {
		case 'protocol': {
			const tvl = formatUsd(preview.tvl, { compact: true })
			return (
				<span className="flex flex-col gap-2 pb-3">
					{preview.category ? <Tag className="self-start">{preview.category}</Tag> : null}
					{tvl ? (
						<span className="flex items-baseline gap-2">
							<span className="mono-xl text-primary tabular-nums">{tvl}</span>
							<span className="body-xs tracking-wider text-tertiary uppercase">TVL</span>
						</span>
					) : null}
					<span className="flex flex-wrap gap-x-3 gap-y-1">
						<ChangeChip value={preview.change1d} comparison="over 24h" />
						<ChangeChip value={preview.change7d} comparison="over 7d" />
						<ChangeChip value={preview.change30d} comparison="over 30d" />
					</span>
					{preview.chains && preview.chains.length > 0 ? (
						<span className="flex flex-wrap gap-1">
							{preview.chains.slice(0, 6).map((c) => (
								<Tag key={c}>{c}</Tag>
							))}
						</span>
					) : null}
				</span>
			)
		}
		case 'chain': {
			const tvl = formatUsd(preview.tvl, { compact: true })
			return (
				<span className="flex flex-col gap-2 pb-3">
					{tvl ? (
						<span className="flex items-baseline gap-2">
							<span className="mono-xl text-primary tabular-nums">{tvl}</span>
							<span className="body-xs tracking-wider text-tertiary uppercase">TVL</span>
						</span>
					) : null}
					<span className="flex flex-wrap gap-x-3 gap-y-1">
						<ChangeChip value={preview.change1d} comparison="over 24h" />
						<ChangeChip value={preview.change7d} comparison="over 7d" />
					</span>
					{typeof preview.protocolCount === 'number' ? (
						<MetricRow label="Protocols" value={formatNumber(preview.protocolCount)} />
					) : null}
				</span>
			)
		}
		case 'stablecoin': {
			const circ = formatUsd(preview.circulating, { compact: true })
			return (
				<span className="flex flex-col gap-2 pb-3">
					<span className="flex flex-wrap gap-1">
						{preview.pegType ? <Tag>{preview.pegType}</Tag> : null}
						{preview.pegMechanism ? <Tag>{preview.pegMechanism}</Tag> : null}
					</span>
					{circ ? (
						<span className="flex items-baseline gap-2">
							<span className="mono-xl text-primary tabular-nums">{circ}</span>
							<span className="body-xs tracking-wider text-tertiary uppercase">Circulating</span>
						</span>
					) : null}
					<ChangeChip value={preview.change7d} comparison="over 7d" />
					{preview.topChains && preview.topChains.length > 0 ? (
						<span className="flex flex-col gap-0.5">
							<span className="body-xs tracking-wider text-tertiary uppercase">Top chains</span>
							{preview.topChains.slice(0, 3).map((c) => (
								<MetricRow key={c.name} label={c.name} value={formatUsd(c.circulating, { compact: true })} />
							))}
						</span>
					) : null}
				</span>
			)
		}
		case 'category': {
			return (
				<span className="flex flex-col gap-2 pb-3">
					<span className="flex items-baseline gap-2">
						<span className="mono-xl text-primary tabular-nums">
							{formatUsd(preview.tvl, { compact: true }) ?? '—'}
						</span>
						<span className="body-xs tracking-wider text-tertiary uppercase">Total TVL</span>
					</span>
					{typeof preview.protocolCount === 'number' ? (
						<MetricRow label="Protocols" value={formatNumber(preview.protocolCount)} />
					) : null}
					{preview.topProtocols && preview.topProtocols.length > 0 ? (
						<span className="mt-1 flex flex-col gap-1">
							<span className="body-xs tracking-wider text-tertiary uppercase">Top protocols</span>
							{preview.topProtocols.map((p) => (
								<span key={p.slug} className="flex items-center gap-2">
									{p.logo ? <img src={p.logo} alt="" className="size-4 shrink-0 rounded-full" loading="lazy" /> : null}
									<span className="truncate body-sm text-secondary">{p.name}</span>
									<span className="ml-auto body-sm text-tertiary tabular-nums">
										{formatUsd(p.tvl, { compact: true })}
									</span>
								</span>
							))}
						</span>
					) : null}
				</span>
			)
		}
		case 'cex': {
			const tvl = formatUsd(preview.tvl, { compact: true })
			const clean = formatUsd(preview.cleanAssetsTvl, { compact: true })
			const cleanRatio =
				typeof preview.tvl === 'number' && typeof preview.cleanAssetsTvl === 'number' && preview.tvl > 0
					? Math.max(0, Math.min(1, preview.cleanAssetsTvl / preview.tvl))
					: null
			return (
				<span className="flex flex-col gap-2 pb-3">
					{tvl ? (
						<span className="flex items-baseline gap-2">
							<span className="mono-xl text-primary tabular-nums">{tvl}</span>
							<span className="body-xs tracking-wider text-tertiary uppercase">Reserves</span>
						</span>
					) : null}
					{cleanRatio !== null ? (
						<span className="flex flex-col gap-1">
							<span className="flex items-baseline justify-between gap-2 body-xs tracking-wider text-tertiary uppercase">
								<span>Clean assets {clean}</span>
								<span className="tabular-nums">
									{formatPercent(cleanRatio, {
										input: 'fraction',
										maximumFractionDigits: 0,
										useGrouping: false
									})}
								</span>
							</span>
							<span className="block h-1 overflow-hidden rounded-sm bg-border-medium">
								<span className="block h-full rounded-sm bg-link" style={{ width: `${cleanRatio * 100}%` }} />
							</span>
						</span>
					) : null}
					{preview.spotVolume != null ? (
						<MetricRow label="Spot 24h" value={formatUsd(preview.spotVolume, { compact: true }) ?? '—'} />
					) : null}
					{preview.inflows1w != null ? (
						<MetricRow label="Net 1w" value={<Change value={preview.inflows1w} unit="usd" />} />
					) : null}
				</span>
			)
		}
		case 'bridge': {
			return (
				<span className="flex flex-col gap-2 pb-3">
					{preview.volume24h != null ? (
						<span className="flex items-baseline gap-2">
							<span className="mono-xl text-primary tabular-nums">
								{formatUsd(preview.volume24h, { compact: true }) ?? '—'}
							</span>
							<span className="body-xs tracking-wider text-tertiary uppercase">24h volume</span>
						</span>
					) : null}
					{preview.volume7d != null ? (
						<MetricRow label="7d Volume" value={formatUsd(preview.volume7d, { compact: true }) ?? '—'} />
					) : null}
					{preview.destinationChain ? <MetricRow label="Destination" value={preview.destinationChain} /> : null}
					{preview.chains && preview.chains.length > 0 ? (
						<span className="flex flex-wrap gap-1">
							{preview.chains.slice(0, 6).map((c) => (
								<Tag key={c}>{c}</Tag>
							))}
						</span>
					) : null}
				</span>
			)
		}
		case 'hack': {
			const dateLabel = formatDate(preview.date)
			const lossLabel = formatUsd(preview.amountUsd, { compact: true })
			const returnedLabel = formatUsd(preview.returnedFundsUsd, { compact: true })
			const recoveredPct =
				typeof preview.amountUsd === 'number' &&
				preview.amountUsd > 0 &&
				typeof preview.returnedFundsUsd === 'number' &&
				preview.returnedFundsUsd > 0
					? Math.min(1, preview.returnedFundsUsd / preview.amountUsd)
					: null
			return (
				<span className="flex flex-col gap-2 pb-3">
					<span className="flex flex-wrap gap-1">
						{preview.classification ? <Tag>{preview.classification}</Tag> : null}
						{preview.bridgeHack ? <Tag>Bridge</Tag> : null}
					</span>
					{lossLabel ? (
						<span className="flex items-baseline gap-2">
							<span className="mono-xl text-error tabular-nums">{lossLabel}</span>
							<span className="body-xs tracking-wider text-tertiary uppercase">Lost</span>
						</span>
					) : null}
					{dateLabel ? <MetricRow label="Date" value={dateLabel} /> : null}
					{preview.technique ? <MetricRow label="Vector" value={preview.technique} /> : null}
					{preview.targetType ? <MetricRow label="Target" value={preview.targetType} /> : null}
					{returnedLabel && recoveredPct !== null ? (
						<MetricRow
							label="Recovered"
							value={
								<span className="text-success">
									{returnedLabel}
									<span className="ml-1 text-tertiary">
										(
										{formatPercent(recoveredPct, {
											input: 'fraction',
											maximumFractionDigits: 0,
											useGrouping: false
										})}
										)
									</span>
								</span>
							}
						/>
					) : null}
					{preview.chains && preview.chains.length > 0 ? (
						<span className="flex flex-wrap gap-1">
							{preview.chains.slice(0, 6).map((c) => (
								<Tag key={c}>{c}</Tag>
							))}
						</span>
					) : null}
				</span>
			)
		}
		case 'metric': {
			return (
				<span className="block pb-3 body-sm text-secondary">{preview.description ?? TYPE_HINT[entity.entityType]}</span>
			)
		}
		default:
			return null
	}
}

export function EntityPreviewLink({
	entity,
	children,
	snapshot
}: {
	entity: ArticleEntityRef
	children: ReactNode
	snapshot?: EntityPreview | null
}) {
	const logo = entityLogoUrl(entity)
	const typeLabel = TYPE_LABEL[entity.entityType] ?? entity.entityType.toUpperCase()
	const previewable = isPreviewableEntityType(entity.entityType)
	// The live preview loads on the first open and stays cached for the next one.
	const [opened, setOpened] = useState(false)

	const { data: liveData, isFetching } = useQuery({
		queryKey: ['article-entity-preview', entity.entityType, entity.slug],
		queryFn: ({ signal }) => fetchEntityPreview(entity.entityType, entity.slug, signal),
		enabled: previewable && opened,
		staleTime: 1000 * 60 * 5,
		gcTime: 1000 * 60 * 30,
		refetchOnWindowFocus: false
	})

	const preview = liveData ?? snapshot ?? null
	const loading = previewable && opened && isFetching && !preview

	return (
		<Hovercard
			placement="top"
			width="md"
			// The link opens the page, so a tap follows it and keyboard readers reach the card through its disclosure.
			showOnClick={false}
			onOpen={() => setOpened(true)}
			className="align-baseline"
			render={
				<a
					href={entity.route}
					target="_blank"
					rel="noopener noreferrer"
					className="article-entity-link font-medium text-link no-underline decoration-(--border-brand-muted) underline-offset-[3px] hover:underline"
				/>
			}
			content={
				<>
					<div className="flex items-center gap-3 pb-2">
						<span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-medium bg-page">
							{logo ? (
								<img src={logo} alt="" height={36} width={36} className="size-full object-cover" />
							) : (
								<span className="body-xs text-tertiary">{entity.label.slice(0, 2).toUpperCase()}</span>
							)}
						</span>
						<div className="flex min-w-0 flex-col">
							<span className="truncate title-md text-primary">{entity.label}</span>
							<span className="truncate body-sm text-tertiary">{typeLabel}</span>
						</div>
					</div>
					<PreviewBody entity={entity} preview={preview} loading={loading} />
					{/* Full-bleed footer row: its hover wash and divider reach the card's edges. */}
					<a
						href={entity.route}
						target="_blank"
						rel="noopener noreferrer"
						className="-mx-3 -mb-3 flex items-center justify-between gap-2 border-t border-medium px-3 py-2 body-sm no-underline hover:bg-page"
					>
						<span className="text-tertiary">Open page</span>
						<span className="truncate text-link">{entity.route}</span>
					</a>
				</>
			}
		>
			{/* Baseline-aligned inside the card's centered anchor, so the name sits on the prose line around it. */}
			<span className="inline-flex items-baseline gap-1">
				{logo ? (
					<img
						src={logo}
						alt=""
						height={14}
						width={14}
						className="relative top-[2px] inline-block size-3.5 shrink-0 rounded-full"
					/>
				) : null}
				{children}
			</span>
		</Hovercard>
	)
}
