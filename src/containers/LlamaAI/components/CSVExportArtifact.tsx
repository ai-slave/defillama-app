import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatNumber } from '~/utils/numberFormat'
import { ArtifactCard } from './messages/ArtifactCard'

export interface CSVExport {
	id: string
	title: string
	url: string
	rowCount: number
	filename: string
}

interface CSVExportArtifactProps {
	csvExport: CSVExport
	sessionId?: string | null
	messageId?: string
}

export function CSVExportArtifact({ csvExport, sessionId, messageId }: CSVExportArtifactProps) {
	const { hasActiveSubscription } = useAuthContext()

	if (!hasActiveSubscription) {
		return (
			<Card padding="sm" className="flex min-h-14 items-center gap-3">
				<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-elevated-2">
					<Icon name="file-text" className="size-4 text-tertiary" />
				</span>
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="m-0 truncate label-md text-primary">{csvExport.title}</span>
					<span className="m-0 body-sm text-secondary">CSV exports require a subscription</span>
				</span>
				<Button as="a" href="https://defillama.com/subscription" size="md" variant="primary">
					Subscribe
				</Button>
			</Card>
		)
	}

	return (
		<ArtifactCard
			as="a"
			icon="file-text"
			title={csvExport.title}
			meta={`${formatNumber(csvExport.rowCount)} rows`}
			trailing={
				<span className="flex shrink-0 items-center gap-1 label-sm text-link">
					<Icon name="download-paper" className="size-3.5" />
					.csv
				</span>
			}
			href={csvExport.url}
			download={csvExport.filename}
			onClick={() =>
				trackUmamiEvent('llamaai-download', {
					kind: 'artifact-csv',
					filename: csvExport.filename,
					title: csvExport.title,
					artifactId: csvExport.id,
					sessionId: sessionId ?? '',
					messageId: messageId ?? ''
				})
			}
		/>
	)
}
