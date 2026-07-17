import { DirectoryHeader } from './DirectoryHeader'
import { DirectoryOverview } from './DirectoryOverview'
import { DirectoryTable } from './DirectoryTable'
import type { ExchangeDirectoryModel, ExchangeOverviewChartModel } from './models'

interface ExchangeDirectoryProps {
	directory: ExchangeDirectoryModel
	loadOverview: () => Promise<ExchangeOverviewChartModel>
}

export function ExchangeDirectory({ directory, loadOverview }: ExchangeDirectoryProps) {
	return (
		<div className="flex flex-1 flex-col gap-2">
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<DirectoryHeader summary={directory.summary} />
				<div className="xl:col-[2/-1]">
					<DirectoryOverview directory={directory} loadOverview={loadOverview} />
				</div>
			</div>
			<DirectoryTable rows={directory.rows} />
		</div>
	)
}
