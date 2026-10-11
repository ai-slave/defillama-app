import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Change } from '~/ui/Change'
import { Icon } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
import { Skeleton } from '~/ui/Skeleton'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import type { PageAssetMarket } from '../pageAssetMarket'
import type { ArticlePageAsset } from '../types'

function formatAssetPrice(price: number | null): string {
	if (price == null || !Number.isFinite(price)) return '—'
	if (price <= 0) return '$0.00'
	if (price >= 1) return formatUsd(price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
	if (price >= 0.01) return formatUsd(price, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
	return formatUsd(price, { maximumFractionDigits: 6 })
}

function usePageAssetMarkets(ids: Array<string>) {
	return useQuery({
		queryKey: ['article-page-assets', ids],
		queryFn: async ({ signal }) => {
			const res = await fetch(`/api/public/research/page-assets?ids=${ids.map(encodeURIComponent).join(',')}`, {
				signal
			})
			if (!res.ok) throw new Error("Couldn't load asset prices.")
			const json = await res.json()
			return (json?.assets ?? []) as Array<PageAssetMarket>
		},
		enabled: ids.length > 0,
		staleTime: 60 * 1000,
		gcTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		refetchInterval: 60 * 1000,
		refetchIntervalInBackground: false,
		retry: 0
	})
}

function AssetRow({
	asset,
	market,
	isLoading
}: {
	asset: ArticlePageAsset
	market: PageAssetMarket | undefined
	isLoading: boolean
}) {
	const route = market?.route ?? null
	const logoSrc = market?.image ?? geckoTokenIconUrl(`coingecko:${asset.geckoId}`)
	const showSkeleton = !market && isLoading
	const symbol = asset.symbol.toUpperCase()
	const change = market?.change24h ?? null

	const content = (
		<>
			<span className="inline-flex shrink-0 group-hover/asset:animate-wiggle">
				<Logo src={logoSrc} size={22} alt={asset.symbol} title={asset.name} />
			</span>
			<span
				className="min-w-0 truncate title-md text-primary transition-colors group-hover/asset:text-link"
				title={asset.name}
			>
				{symbol}
			</span>
			<span className="ml-auto title-md text-primary tabular-nums">
				{showSkeleton ? (
					<Skeleton className="inline-block h-3.5 w-14 align-middle" />
				) : (
					formatAssetPrice(market?.price ?? null)
				)}
			</span>
			<span className="w-[52px] shrink-0 text-right label-sm tabular-nums">
				{showSkeleton ? <Skeleton className="inline-block h-3 w-9 align-middle" /> : <Change value={change} />}
			</span>
		</>
	)

	if (!route) {
		return <li className="flex items-center gap-2.5 px-3 py-2.5">{content}</li>
	}

	return (
		<li>
			<a
				href={route}
				target="_blank"
				rel="noreferrer noopener"
				className="group/asset flex items-center gap-2.5 px-3 py-2.5 no-underline transition-colors hover:bg-hover-row focus-visible:bg-hover-row focus-visible:outline-hidden"
			>
				{content}
			</a>
		</li>
	)
}

export function ArticlePageAssets({ pageAssets }: { pageAssets?: Array<ArticlePageAsset> | null }) {
	const assets = pageAssets ?? []
	const ids = useMemo(
		() => Array.from(new Set((pageAssets ?? []).map((asset) => asset.geckoId).filter(Boolean))),
		[pageAssets]
	)
	const { data, isLoading } = usePageAssetMarkets(ids)
	const byId = useMemo(() => new Map((data ?? []).map((m) => [m.geckoId, m])), [data])
	const [open, setOpen] = useState(true)

	if (assets.length === 0) return null

	return (
		<section aria-label="Assets on this page" className="grid">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				className={`group flex items-center justify-between gap-2 transition-[min-height] duration-300 ease-out ${
					open ? 'min-h-0' : 'min-h-[66px]'
				}`}
			>
				<span className="flex items-center gap-2 label-xs tracking-[0.18em] text-tertiary uppercase">
					Assets on this page
					<span className="rounded-full bg-surface-elevated-2 px-1.5 py-0.5 label-xs tracking-normal text-tertiary">
						{assets.length}
					</span>
				</span>
				<Icon
					name="chevron-down"
					className={`size-3.5 shrink-0 text-tertiary transition-transform duration-200 group-hover:text-secondary ${
						open ? '' : '-rotate-90'
					}`}
				/>
			</button>
			<div
				className={`grid transition-[grid-template-rows] duration-300 ease-out ${
					open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
				}`}
			>
				<div className="overflow-hidden">
					<ul className="mt-3 mb-0 list-none divide-y divide-(--border-medium) overflow-hidden rounded-xl border border-medium p-0">
						{assets.map((asset) => (
							<AssetRow key={asset.geckoId} asset={asset} market={byId.get(asset.geckoId)} isLoading={isLoading} />
						))}
					</ul>
				</div>
			</div>
		</section>
	)
}
