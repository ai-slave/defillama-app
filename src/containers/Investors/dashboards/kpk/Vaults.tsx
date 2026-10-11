import { useMemo, useState } from 'react'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelStatus } from '~/ui/Status'
import { formatDate } from '~/utils/dateFormat'
import { formatNumber, formatPercent, PERCENT_POINTS_TWO_DECIMALS_OPTIONS } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { useTab, type KpkVault, type KpkVaults } from './api'
import { KPK_MINT_TEXT } from './chartDefaults'
import { CompositionSection } from './CompositionSection'
import {
	andList,
	Card,
	DataTable,
	Disclaimer,
	InfoTip,
	LedgerStrip,
	LedgerTile,
	MeterBar,
	REBALANCING_REF,
	RefLinks,
	RowLink,
	Spark,
	signClass,
	signedBps,
	usdFromMillions,
	KPK_PERCENT_OPTIONS
} from './ui'
import { ALL_VENUES, doubleCountedVenues, endSentence, vaultFooterRows, vaultRefs, vaultsOnVenue } from './vaultsModel'

const DOUBLE_COUNT_NOTE = 'Counted inside another vault on this table. Excluded from the adjusted totals.'

const LEGAL_URL = 'https://docs.kpk.io/vaults/resources/legal'

/**
 * Three distinct states, rendered as three distinct things: a count (`0` is a real
 * count), "not applicable" for venues with no rebalancing agent, and "no source".
 */
function RebalanceCell({ value }: { value: KpkVault['rebalances30d'] }) {
	if (value === 'NA') {
		return (
			<span className="text-tertiary">
				<InfoTip text="Passive lending pool — no rebalancing agent to count" className="mr-1" />
				n/a
			</span>
		)
	}
	return <>{formatNumber(value, { maximumFractionDigits: 0 }) ?? '—'}</>
}

export default function Vaults() {
	const query = useTab<KpkVaults>('vaults')
	const { data } = query
	const [venue, setVenue] = useState<string>(ALL_VENUES)

	const venueOptions = useMemo(
		() => [{ value: ALL_VENUES, label: 'All' }, ...(data?.venues ?? []).map((name) => ({ value: name, label: name }))],
		[data?.venues]
	)

	const rows = useMemo(() => (data ? vaultsOnVenue(data.list, venue) : undefined), [data, venue])
	const doubleCountNote = data?.doubleCountNote ?? DOUBLE_COUNT_NOTE
	const adjustedVenues = useMemo(() => doubleCountedVenues(data?.list ?? []), [data?.list])
	const showAdjustedTva = data?.tvaAdjusted != null && adjustedVenues.length > 0
	const refs = useMemo(() => vaultRefs(data?.refs), [data?.refs])
	const footer = useMemo(() => (rows ? vaultFooterRows(rows, doubleCountNote) : undefined), [rows, doubleCountNote])

	if (queryReadFailed(query)) {
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load vault data.
			</PanelStatus>
		)
	}

	return (
		<div className="flex flex-col gap-5">
			<LedgerStrip>
				<LedgerTile
					label="Curated Total Value Allocated"
					value={data ? usdFromMillions(data.tva) : undefined}
					sub={data ? `Across ${data.count} vaults on ${andList(data.venues)}` : undefined}
					metric={showAdjustedTva ? usdFromMillions(data?.tvaAdjusted) : undefined}
					metricLabel={showAdjustedTva ? `adjusted, excluding ${andList(adjustedVenues)}` : undefined}
					metricTitle={showAdjustedTva ? doubleCountNote : undefined}
				/>
				{/* No `+` suffix: unlike the brief-stated facts on Overview, this is an exact
				    figure from Dune, so "at least" would understate a number we know. */}
				<LedgerTile
					label="Agent rebalancing volume"
					value={data?.rebalancingVolume}
					sub="Executed by KPK's non-custodial rebalancing and exit agents on Vaults and Funds"
					subRef={data ? (data.rebalancingRef ?? REBALANCING_REF) : undefined}
					metric={data?.rebalancingActionsLabel}
					metricLabel="cumulative rebalancing actions"
				/>
				<LedgerTile
					label="Instant liquidity"
					value={data ? (formatPercent(data.liquidityPct, KPK_PERCENT_OPTIONS) ?? '—') : undefined}
					suffix={data ? 'of TVA' : undefined}
					sub={
						data
							? `Aggregate instantly withdrawable share of curated TVA against a ${formatPercent(data.liquidityTarget, KPK_PERCENT_OPTIONS) ?? '—'} target`
							: undefined
					}
				/>
			</LedgerStrip>

			<CompositionSection
				title="Curated Total Value Allocated"
				subtitle={data ? `Daily readings through ${formatDate(data.compAsOf)}` : undefined}
				comps={data?.comp}
				initialKey="venue"
			/>

			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="heading-xs">Vaults</h2>
					<SegmentedControl
						variant="default"
						size="md"
						label="Filter vaults by venue"
						options={venueOptions}
						value={venue}
						onValueChange={setVenue}
					/>
				</div>
				<Card>
					<DataTable<KpkVault>
						getOccurrenceKey={(row) => JSON.stringify([row.chain, row.venue, row.name, row.asset])}
						freeze="panes"
						rows={rows}
						empty={`No ${venue === ALL_VENUES ? '' : `${venue} `}vaults`}
						cols={[
							{
								key: 'name',
								label: 'Vault',
								render: (row) => (
									<span className="flex flex-col">
										<span className="text-primary">
											{row.name}
											{row.doubleCounted && <InfoTip text={doubleCountNote} className="ml-1" />}{' '}
											<RowLink href={row.url} label={row.name} size="sm" />
										</span>
										<span className="body-sm text-tertiary">
											{row.venue} · {row.chain}
										</span>
									</span>
								)
							},
							{ key: 'tva', label: 'TVA', right: true, render: (row) => usdFromMillions(row.tva) },
							{
								key: 'apy',
								label: 'APY',
								right: true,
								render: (row) => (
									<span className="flex items-center justify-end gap-2">
										<span className={KPK_MINT_TEXT}>
											{formatPercent(row.apy, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}
										</span>
										<Spark values={row.apyHistory} label={`${row.name} APY history`} />
									</span>
								)
							},
							{
								key: 'apy30',
								label: 'APY 30d',
								right: true,
								render: (row) => formatPercent(row.apy30, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'
							},
							{
								key: 'spreadBps',
								label: 'vs benchmark',
								right: true,
								render: (row) => (
									<span className="flex flex-col items-end">
										<span className={signClass(row.spreadBps)}>{signedBps(row.spreadBps)}</span>
										{row.benchName && <span className="body-sm text-tertiary">{row.benchName}</span>}
									</span>
								)
							},
							{
								key: 'interest',
								label: 'Interest earned',
								right: true,
								render: (row) => usdFromMillions(row.interest)
							},
							{
								key: 'liq',
								label: 'Instant liquidity',
								title: "Share of the current TVA that's available to withdraw instantly",
								right: true,
								render: (row) => (
									<span className="flex items-center justify-end gap-2">
										<span className={row.belowTarget ? 'text-warning' : undefined}>
											{formatPercent(row.liq, KPK_PERCENT_OPTIONS) ?? '—'} /{' '}
											{formatPercent(row.liqTarget, {
												input: 'percent',
												smallValueDisplay: 'rounded',
												maximumFractionDigits: 0,
												useGrouping: false
											}) ?? '—'}
										</span>
										<MeterBar value={row.liq} target={row.liqTarget} tone={row.belowTarget ? 'warning' : 'accent'} />
									</span>
								)
							},
							{
								key: 'rebalances30d',
								label: 'Rebalances 30d',
								right: true,
								render: (row) => <RebalanceCell value={row.rebalances30d} />
							},
							{
								key: 'deriskingAutomations',
								label: 'Derisking automations',
								title:
									'All-time count of agent-executed derisking rebalances. Only venues with an agent-attributed event source report a figure.',
								right: true,
								render: (row) => formatNumber(row.deriskingAutomations, { maximumFractionDigits: 0 }) ?? '—'
							},
							{ key: 'losses', label: 'Incurred losses', render: () => 'None' },
							{ key: 'exposure', label: 'Collateral & market exposure', wrap: true }
						]}
						footer={footer}
					/>
				</Card>
			</section>

			<RefLinks refs={refs} />

			{data?.riskDisclaimer && (
				<Disclaimer title="Risk disclaimer">
					{endSentence(data.riskDisclaimer)} See our full legal disclaimers at{' '}
					<a
						href={LEGAL_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="underline underline-offset-2 transition-colors hover:text-link"
					>
						docs.kpk.io/vaults/resources/legal
					</a>
					.
				</Disclaimer>
			)}
		</div>
	)
}
