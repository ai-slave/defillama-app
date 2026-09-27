import { useCustomServerData } from '~/containers/Investors/CustomServerDataContext'
import { EmissionsByProtocol } from '~/containers/Unlocks/EmissionsByProtocol'
import { ApiTrendChart } from './ChainBreakdownChart'
import type { ThorchainUnlocks } from './serverData'
import type { Chart, Kpi as KpiT } from './transform'
import { Kpi, SectionHeader, useThorchainData } from './ui'

// RUNE token unlocks — rendered with the same EmissionsByProtocol component as /unlocks/thorchain-dex,
// fed by server-side data (keyed pro API) via the customServerData pipeline. Server keying is required:
// the all-emissions list behind Locked/Unlocked % is rate-limited on the free public host, which is why
// the in-browser ProDashboard cards (client-side, unkeyed) rendered it empty.
export default function Unlocks() {
	const data = useCustomServerData<ThorchainUnlocks>('thorchainUnlocks')
	// Historical unlock schedule from raynalytics (via the ir-server): RUNE is 100%
	// unlocked, so this is a record, not a forecast. Monthly deltas by allocation
	// category; the cumulative view shows the progression to full unlock.
	const { data: history } = useThorchainData<{ unlockChart: Chart | null; kpis: Record<string, KpiT | undefined> }>(
		'unlocks'
	)

	return (
		<div className="flex flex-col gap-6">
			<SectionHeader>RUNE Token Unlocks</SectionHeader>
			{data?.emissions ? (
				<EmissionsByProtocol
					data={data.emissions}
					initialTokenMarketData={data.initialTokenMarketData}
					generatedAtSec={data.generatedAtSec}
					isEmissionsPage
					disableClientTokenStatsFetch
					// Percentage pies (Allocation / Unlocked %) carry the story here; the
					// price/mcap/volume stat band was dropped per the protocol's review.
					hideTokenStats
				/>
			) : (
				<p className="flex h-[360px] items-center justify-center text-center text-xs text-pro-text-tertiary">
					No unlocks data.
				</p>
			)}

			{history?.unlockChart && (
				<>
					<SectionHeader>Historical Unlock Schedule</SectionHeader>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<Kpi kpi={history.kpis.totalUnlocked} label="Unlocked (Allocations)" />
						<Kpi kpi={history.kpis.unlockedPct} label="Unlocked %" />
					</div>
					<ApiTrendChart
						chart={history.unlockChart}
						valueSymbol=""
						defaultView="month"
						subtitle="RUNE is fully unlocked. Historical unlocks by allocation category; the Cumulative view shows the progression."
					/>
				</>
			)}
		</div>
	)
}
