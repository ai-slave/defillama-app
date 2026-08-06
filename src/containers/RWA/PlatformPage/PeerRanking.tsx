import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { fetchJson } from '~/utils/async'
import { formatCompactNumber, formatNumber, formatUsd } from '~/utils/numberFormat'
import type { RWAPlatformPeerRow } from './types'

const compactUsdOptions = {
	compact: true,
	minimumCompactValue: 1_000_000,
	compactSuffix: 'lowercase'
} as const

function formatBps(value: number): string {
	return `${formatNumber(value)} bps`
}

export function fetchRWAPlatformPeers(): Promise<RWAPlatformPeerRow[]> {
	return fetchJson<RWAPlatformPeerRow[]>('/api/public/rwa/platform-peers')
}

export function PeerRanking({ selectedSlug }: { selectedSlug: string }) {
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const selectedRowRef = useRef<HTMLTableRowElement>(null)
	const {
		data: peers,
		isLoading,
		error
	} = useQuery({
		queryKey: ['rwa-platform-peers'],
		queryFn: fetchRWAPlatformPeers,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1
	})

	// Client data arrives after the first render, so peers is a dependency: this
	// must rerun when the selected row is mounted, not only when its slug changes.
	useEffect(() => {
		const container = scrollContainerRef.current
		const row = selectedRowRef.current
		if (!container || !row) return
		const containerRect = container.getBoundingClientRect()
		const rowRect = row.getBoundingClientRect()
		const headerHeight = container.querySelector('thead')?.getBoundingClientRect().height ?? 0
		const isFullyVisible = rowRect.top >= containerRect.top + headerHeight && rowRect.bottom <= containerRect.bottom
		if (isFullyVisible) return
		container.scrollTop += rowRect.top - containerRect.top - (container.clientHeight - rowRect.height) / 2
	}, [peers, selectedSlug])

	if (isLoading) return <PanelLoadingStatus label="Loading peer ranking" />
	if (error || !peers) return <PanelStatus variant="error">Failed to load peer ranking.</PanelStatus>

	return (
		<Panel padding="none">
			<PanelHeader>
				<PanelTitle>Peer ranking</PanelTitle>
				<span className="body-sm text-tertiary">{peers.length} active platforms</span>
			</PanelHeader>
			<div ref={scrollContainerRef} className="max-h-[720px] overflow-auto">
				<table className="w-full min-w-[850px] border-collapse text-left">
					<thead className="sticky top-0 z-10 bg-surface">
						<tr className="border-b border-subtle text-sm font-medium text-secondary">
							<th className="px-3 py-2 text-right">#</th>
							<th className="px-3 py-2">Platform</th>
							<th className="px-3 py-2 text-right">On-chain AUM</th>
							<th className="px-3 py-2 text-right">Live assets</th>
							<th className="px-3 py-2 text-right">Holder fee</th>
							<th className="px-3 py-2 text-right">Mint fee</th>
							<th className="px-3 py-2 text-right">Redemption fee</th>
						</tr>
					</thead>
					<tbody>
						{peers.map((peer) => {
							const isSelected = peer.slug === selectedSlug
							return (
								<tr
									key={peer.slug}
									ref={isSelected ? selectedRowRef : undefined}
									className={`border-b border-subtle last:border-0 ${
										isSelected ? 'bg-brand-muted' : 'hover:bg-hover-row'
									}`}
								>
									<td className="px-3 py-2 text-right">{peer.rank}</td>
									<td className="px-3 py-2">
										<span className="flex items-center gap-2">
											<TokenLogo src={peer.logo} size={24} alt={`${peer.name} logo`} />
											<BasicLink
												href={`/rwa/platform/${peer.slug}`}
												className="truncate label-md text-link hover:underline"
												aria-current={isSelected ? 'page' : undefined}
											>
												{peer.name}
											</BasicLink>
											{isSelected ? (
												<span className="rounded-full border border-brand bg-brand-muted px-1.5 py-0.5 label-sm text-link">
													Current
												</span>
											) : null}
										</span>
									</td>
									<td className="px-3 py-2 text-right">{formatUsd(peer.onchainAum, compactUsdOptions)}</td>
									<td className="px-3 py-2 text-right">{formatCompactNumber(peer.assetCount)}</td>
									<td className="px-3 py-2 text-right">
										{peer.holderTotalFeeBps == null ? '–' : formatBps(peer.holderTotalFeeBps)}
									</td>
									<td className="px-3 py-2 text-right">{peer.mintFeeBps == null ? '–' : formatBps(peer.mintFeeBps)}</td>
									<td className="px-3 py-2 text-right">
										{peer.redemptionFeeBps == null ? '–' : formatBps(peer.redemptionFeeBps)}
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</Panel>
	)
}
