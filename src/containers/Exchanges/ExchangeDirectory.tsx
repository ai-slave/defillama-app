import { DirectoryHeader } from './DirectoryHeader'
import { DirectoryOverview } from './DirectoryOverview'
import { DirectoryTable } from './DirectoryTable'
import type { useExchangeCountry } from './ExchangeCountrySelect'
import type { ExchangeDirectoryModel, ExchangeOverviewChartModel } from './models'

interface ExchangeDirectoryProps {
	directory: ExchangeDirectoryModel
	loadOverview: () => Promise<ExchangeOverviewChartModel>
	countryState: ReturnType<typeof useExchangeCountry>
}

export function ExchangeDirectory({ directory, loadOverview, countryState }: ExchangeDirectoryProps) {
	return (
		<div className="flex flex-1 flex-col gap-2">
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<DirectoryHeader summary={directory.summary} />
				<div className="xl:col-[2/-1]">
					<DirectoryOverview
						directory={directory}
						loadOverview={loadOverview}
						showGlobalDataNotice={countryState.country !== null}
					/>
				</div>
			</div>
			<DirectoryTable
				rows={directory.rows}
				country={countryState.country}
				catalog={countryState.catalog}
				catalogFailed={countryState.catalogFailed}
				executionAvailable={directory.executionAvailable}
				onCountryChange={countryState.setCountry}
			/>
		</div>
	)
}
