import { StatTile } from '~/ui/SummaryStats'
import { formatNumber } from '~/utils/numberFormat'
import { useTab, type TreasuryResponse } from './api'
import { ChartCard, SectionHeader, SimpleTable, fmtUsd } from './ui'

export default function Treasury() {
	const { data } = useTab<TreasuryResponse>('treasury')
	const tlp = data?.treasuryLps
	const eth = data?.ethUniv3
	const plasma = data?.plasmaUniv3
	const cvx = data?.vlCvx
	const aero = data?.veAero
	const gov = data?.govLocks
	const met = data?.metronomeAllocation
	const ves = data?.vesperAllocation

	return (
		<div className="flex flex-col gap-6">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{data ? (
					<>
						<StatTile
							label="Treasury LP Total"
							value={tlp?.totalFormatted ?? '—'}
							sub={`Unclaimed ${tlp?.unclaimedRewardsFormatted || ''}`}
						/>
						<StatTile label="Ethereum UniV3 Total" value={eth?.totalFormatted ?? '—'} />
						<StatTile label="Plasma UniV3 Total" value={plasma?.totalFormatted ?? '—'} />
						<StatTile label="veAERO Locks" value={aero?.rows ? String(aero.rows.length) : '—'} />
					</>
				) : (
					<>
						<StatTile label="Treasury LP Total" loading />
						<StatTile label="Ethereum UniV3 Total" loading />
						<StatTile label="Plasma UniV3 Total" loading />
						<StatTile label="veAERO Locks" loading />
					</>
				)}
			</div>

			<SectionHeader>Treasury LP Positions</SectionHeader>
			<ChartCard
				title="LP Positions (all chains)"
				subtitle={`${tlp?.rows?.length ?? 0} positions across Base, Optimism, Plasma`}
			>
				<SimpleTable
					getOccurrenceKey={(row) => row.pool}
					rows={tlp?.rows}
					cols={[
						{ key: 'pool', label: 'Pool' },
						{ key: 'stakedLp', label: 'Staked LP' },
						{ key: 'rewards', label: 'Pending Rewards' },
						{ key: 'rewardsUsd', label: 'Rewards USD', right: true, render: (r) => fmtUsd(r.rewardsUsd) },
						{ key: 'valueUsd', label: 'Position Value', right: true, render: (r) => fmtUsd(r.valueUsd) }
					]}
				/>
			</ChartCard>

			{eth?.rows?.length ? (
				<>
					<SectionHeader>Ethereum UniV3 Positions</SectionHeader>
					<ChartCard title="Ethereum positions">
						<SimpleTable
							getOccurrenceKey={(row) => row.pool}
							rows={eth.rows}
							cols={[
								{ key: 'pool', label: 'Pool' },
								{ key: 'rewards', label: 'Pending Rewards' },
								{ key: 'usd', label: 'USD', right: true, render: (r) => fmtUsd(r.usd) }
							]}
						/>
					</ChartCard>
				</>
			) : null}

			<SectionHeader>Plasma UniV3 Unclaimed Fees</SectionHeader>
			<ChartCard title="Plasma positions" subtitle="One row per NFT">
				<SimpleTable
					getOccurrenceKey={(row) => row.pool}
					rows={plasma?.rows}
					cols={[
						{ key: 'pool', label: 'Position' },
						{ key: 'rewards', label: 'Pending Rewards' },
						{ key: 'usd', label: 'USD', right: true, render: (r) => fmtUsd(r.usd) }
					]}
				/>
			</ChartCard>

			<SectionHeader>Convex vlCVX Locks</SectionHeader>
			<ChartCard title="vlCVX">
				<SimpleTable
					getOccurrenceKey={(row) => JSON.stringify([row.type, row.unlock])}
					rows={cvx?.rows}
					cols={[
						{ key: 'type', label: 'Lock' },
						{ key: 'balance', label: 'Balance' },
						{ key: 'status', label: 'Status' },
						{ key: 'unlock', label: 'Unlock', right: true, render: (r) => r.unlock || '—' }
					]}
				/>
			</ChartCard>

			<SectionHeader>veAERO NFTs</SectionHeader>
			<ChartCard title="veAERO holdings">
				<SimpleTable
					getOccurrenceKey={(row) => String(row.nft)}
					rows={aero?.rows}
					cols={[
						{ key: 'nft', label: 'NFT' },
						{ key: 'locked', label: 'Locked AERO' },
						{ key: 'rewards', label: 'Pending Rewards' },
						{ key: 'unlock', label: 'Unlock', right: true, render: (r) => r.unlock || '—' }
					]}
				/>
			</ChartCard>

			{gov?.rows?.length ? (
				<>
					<SectionHeader>{gov.title || 'Locked Governance Tokens'}</SectionHeader>
					<ChartCard title="esMET / esVSP">
						<SimpleTable
							getOccurrenceKey={(row) => row.token}
							rows={gov.rows}
							cols={[
								{ key: 'token', label: 'Token' },
								{
									key: 'lockedTokens',
									label: 'Locked',
									right: true,
									render: (r) =>
										typeof r.lockedTokens === 'number' ? (formatNumber(r.lockedTokens) ?? '—') : r.lockedTokens
								},
								{
									key: 'supply',
									label: 'Supply',
									right: true,
									render: (r) => (typeof r.supply === 'number' ? (formatNumber(r.supply) ?? '—') : r.supply)
								},
								{ key: 'nftCount', label: 'NFTs', right: true },
								{
									key: 'avgLockYears',
									label: 'Avg Lock (yrs)',
									right: true,
									render: (r) => (r.avgLockYears != null ? formatNumber(r.avgLockYears) : '—')
								},
								{
									key: 'avgRemainingYears',
									label: 'Avg Remaining (yrs)',
									right: true,
									render: (r) => (r.avgRemainingYears != null ? formatNumber(r.avgRemainingYears) : '—')
								}
							]}
						/>
					</ChartCard>
				</>
			) : null}

			<SectionHeader>TVL Allocation by Bucket</SectionHeader>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<ChartCard title={met?.title || 'Metronome Allocation'}>
					<SimpleTable
						getOccurrenceKey={(row) => row.bucket}
						rows={met?.rows}
						cols={[
							{ key: 'bucket', label: 'Bucket' },
							{ key: 'share', label: 'Share', right: true },
							{ key: 'value', label: 'Value', right: true }
						]}
					/>
				</ChartCard>
				<ChartCard title={ves?.title || 'Vesper Allocation'}>
					<SimpleTable
						getOccurrenceKey={(row) => row.bucket}
						rows={ves?.rows}
						cols={[
							{ key: 'bucket', label: 'Bucket' },
							{ key: 'share', label: 'Share', right: true },
							{ key: 'value', label: 'Value', right: true }
						]}
					/>
				</ChartCard>
			</div>
		</div>
	)
}
