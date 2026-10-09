import { useEffect, useRef, useState } from 'react'
import { Card } from '~/ui/Card'
import { PanelStatus, PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { formatNumber, formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { useNetworkStatsData } from './networkStatsApi'

interface BurnBlock {
	block_number: number
	timestamp: number
	gas_used: number
	tx_count: number
	base_fee_per_gas_gwei: string
	block_burn_s: string
	total_burned_s: string
}

interface BurnWindow {
	burned_s: string
	window_seconds: number
}

interface BurnStreamState {
	totalBurnedS: number
	blockNumber: number
	recentBlocks: Array<BurnBlock>
	burnWindows: Record<string, BurnWindow> | null
	connected: boolean
}

function useBurnStream() {
	const [state, setState] = useState<BurnStreamState>({
		totalBurnedS: 0,
		blockNumber: 0,
		recentBlocks: [],
		burnWindows: null,
		connected: false
	})
	const initialized = useRef(false)

	useEffect(() => {
		let es: EventSource | null = null
		const handleInit = (e: MessageEvent) => {
			const data = JSON.parse(e.data)
			initialized.current = true
			setState({
				totalBurnedS: parseFloat(data.total_burned_s),
				blockNumber: data.block_number,
				recentBlocks: (data.recent_blocks || []).slice(0, 15),
				burnWindows: data.burn_windows || null,
				connected: true
			})
		}
		const handleBlock = (e: MessageEvent) => {
			const block: BurnBlock = JSON.parse(e.data)
			setState((prev) => ({
				...prev,
				totalBurnedS: parseFloat(block.total_burned_s),
				blockNumber: block.block_number,
				recentBlocks: [block, ...prev.recentBlocks.slice(0, 14)]
			}))
		}

		function handleError() {
			setState((prev) => ({ ...prev, connected: false }))
		}

		try {
			es = new EventSource('/api/dynamic/sonic/burn-stream')
			es.addEventListener('init', handleInit)
			es.addEventListener('block', handleBlock)

			es.addEventListener('error', handleError)
		} catch {
			// EventSource not supported or connection failed
		}

		return () => {
			if (!es) return
			es.removeEventListener('init', handleInit)
			es.removeEventListener('block', handleBlock)
			es.removeEventListener('error', handleError)
			es.close()
		}
	}, [])

	return state
}

function formatBurnValue(s: string | number): string {
	const n = typeof s === 'string' ? parseFloat(s) : s
	const fractionDigits = Math.abs(n) < 1 ? 6 : 2
	return formatCompactNumber(n, {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	})
}

function formatGas(n: number): string {
	const fractionDigits = Math.abs(n) >= 1e6 ? 1 : Math.abs(n) >= 1e3 ? 0 : undefined
	return formatCompactNumber(n, {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	})
}

function timeAgo(ts: number): string {
	const diff = Math.floor(Date.now() / 1000) - ts
	if (diff < 5) return 'just now'
	if (diff < 60) return `${diff}s ago`
	if (diff < 3600) return `${Math.floor(diff / 60)}min ago`
	return `${Math.floor(diff / 3600)}h ago`
}

function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="title-sm tracking-wider text-secondary uppercase">{children}</h2>
}

function BurnCounter({ totalBurnedS, price }: { totalBurnedS: number; price: number | null }) {
	const [displayValue, setDisplayValue] = useState(totalBurnedS)
	const animRef = useRef<number>(0)
	// Where the counter currently sits, written by the animation frames, so a new target animates from it
	// without the effect depending on the displayed value.
	const shownRef = useRef(totalBurnedS)

	useEffect(() => {
		const start = shownRef.current
		const diff = totalBurnedS - start
		if (Math.abs(diff) < 1e-10) return

		const duration = 400
		const startTime = performance.now()

		const animate = (now: number) => {
			const elapsed = now - startTime
			const progress = Math.min(elapsed / duration, 1)
			// ease-out-quart
			const eased = 1 - (1 - progress) ** 4
			const next = start + diff * eased
			shownRef.current = next
			setDisplayValue(next)
			if (progress < 1) {
				animRef.current = requestAnimationFrame(animate)
			}
		}

		cancelAnimationFrame(animRef.current)
		animRef.current = requestAnimationFrame(animate)

		return () => cancelAnimationFrame(animRef.current)
	}, [totalBurnedS])

	const parts = formatNumber(displayValue, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).split('.')
	const intPart = parts[0]
	const decPart = parts[1]

	return (
		<div>
			<div className="mono-xl text-primary tabular-nums">
				{intPart}
				<span className="text-secondary">.{decPart}</span>
				<span className="ml-2 heading-sm text-secondary">S</span>
			</div>
			{price != null && displayValue > 0 && (
				<span className="mt-1 block body-md text-secondary tabular-nums">
					{formatUsd(displayValue * price, { maximumFractionDigits: 0 })} USD
				</span>
			)}
		</div>
	)
}

export default function NetworkStats() {
	const { query, data } = useNetworkStatsData()
	const stream = useBurnStream()

	// A failed refresh of data already shown keeps it; the error and its Try again replace the tab only before data loads.
	if (queryReadFailed(query) && !query.data)
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load Sonic network stats.
			</PanelStatus>
		)
	if (!data) return <PanelLoadingStatus />

	const burnWindows = stream.burnWindows
	const liveBlock = stream.blockNumber || data.network.blockNumber?.value

	return (
		<div className="flex flex-col gap-6">
			{/* Live Burn Counter */}
			<div className="rounded-xl border border-subtle bg-surface p-6">
				<div className="flex items-start justify-between gap-4">
					<div>
						<div className="flex items-center gap-3">
							<span className="title-sm tracking-wider text-secondary uppercase">Total S Burned</span>
							{stream.connected && (
								<span className="flex items-center gap-1.5 body-sm text-success">
									<span className="inline-block size-1.5 rounded-full bg-success motion-safe:animate-pulse" />
									Live
								</span>
							)}
						</div>
						<div className="mt-3">
							<BurnCounter totalBurnedS={stream.totalBurnedS} price={data.network.price?.value ?? null} />
						</div>
					</div>
				</div>

				{burnWindows && (
					<div className="mt-5 flex flex-wrap gap-3">
						{(['1h', '24h', '7d', '30d'] as const).map((key) => {
							const w = burnWindows[key]
							if (!w) return null
							return (
								<div key={key} className="flex items-baseline gap-1.5 rounded-md border border-medium px-3 py-1.5">
									<span className="body-sm text-secondary">{key}</span>
									<span className="title-md text-primary tabular-nums">{formatBurnValue(w.burned_s)} S</span>
								</div>
							)
						})}
					</div>
				)}
			</div>

			{/* Network Vitals */}
			<div className="flex flex-col gap-4">
				<SectionHeader>Network</SectionHeader>
				<div className="grid grid-cols-3 gap-4">
					<StatTile label="Latest Block" value={liveBlock ? formatNumber(liveBlock) : '—'} />
					{data.network.gasPrice && <StatTile label="Gas Price" value={data.network.gasPrice.formatted} />}
					{data.network.price && <StatTile label="S Price" value={data.network.price.formatted} />}
				</div>
			</div>

			{/* Recent Blocks */}
			{stream.recentBlocks.length > 0 && (
				<div className="flex flex-col gap-4">
					<SectionHeader>Recent Blocks</SectionHeader>
					<div className="overflow-x-auto rounded-lg border border-subtle bg-surface">
						<table className="w-full">
							<thead>
								<tr className="border-b border-subtle">
									<th className="px-4 py-3 text-left title-sm tracking-wide text-secondary uppercase">Block</th>
									<th className="px-4 py-3 text-left title-sm tracking-wide text-secondary uppercase">Txs</th>
									<th className="px-4 py-3 text-left title-sm tracking-wide text-secondary uppercase">Gas Used</th>
									<th className="px-4 py-3 text-left title-sm tracking-wide text-secondary uppercase">Burned</th>
									<th className="hidden px-4 py-3 text-right title-sm tracking-wide text-secondary uppercase sm:table-cell">
										Time
									</th>
								</tr>
							</thead>
							<tbody>
								{stream.recentBlocks.map((block) => (
									<tr key={block.block_number} className="border-b border-subtle last:border-b-0 hover:bg-hover-row">
										<td className="px-4 py-2.5 label-md text-primary tabular-nums">
											{formatNumber(block.block_number)}
										</td>
										<td className="px-4 py-2.5 body-md text-primary tabular-nums">{block.tx_count}</td>
										<td className="px-4 py-2.5 body-md text-primary tabular-nums">{formatGas(block.gas_used)}</td>
										<td className="px-4 py-2.5 body-md text-primary tabular-nums">
											{formatNumber(parseFloat(block.block_burn_s), {
												minimumFractionDigits: 6,
												maximumFractionDigits: 6
											})}{' '}
											S
										</td>
										<td className="hidden px-4 py-2.5 text-right body-sm text-secondary sm:table-cell">
											{timeAgo(block.timestamp)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Fees & Epoch */}
			{(data.fees || data.epoch) && (
				<div className="flex flex-col gap-4">
					<SectionHeader>Fees & Epoch</SectionHeader>
					<div className="rounded-lg border border-subtle bg-surface">
						<div className="flex flex-col divide-y divide-(--border-subtle)">
							{data.fees && (
								<>
									<InfoRow label="Fees / Day" value={data.fees.feesPerDay.formatted} />
									<InfoRow label="FeeM / Day" value={data.fees.feeMPerDay.formatted} />
									<InfoRow label="Validator Fees / Day" value={data.fees.validatorFeesPerDay.formatted} />
									<InfoRow label="Burn Rate" value={data.fees.burnRate.formatted} />
								</>
							)}
							{data.epoch && (
								<>
									<InfoRow label="Current Epoch" value={data.epoch.current.formatted} />
									<InfoRow label="Avg Epoch Duration" value={data.epoch.avgDuration.formatted} />
								</>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Uptime Link */}
			<Card
				as="a"
				padding="md"
				href={data.uptimeUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="hover-wash-card flex items-center justify-between"
			>
				<div>
					<span className="label-md text-primary">Network Uptime</span>
					<span className="ml-2 body-sm text-secondary">uptime.soniclabs.com</span>
				</div>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					aria-hidden="true"
					className="size-4 text-secondary"
				>
					<path d="M7 17L17 7M17 7H7M17 7v10" />
				</svg>
			</Card>
		</div>
	)
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between px-4 py-3">
			<span className="body-md text-secondary">{label}</span>
			<span className="title-md text-primary tabular-nums">{value}</span>
		</div>
	)
}
