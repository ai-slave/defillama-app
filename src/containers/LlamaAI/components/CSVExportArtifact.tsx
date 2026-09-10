import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatNumber } from '~/utils/numberFormat'

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
			<div className="flex items-center gap-3 rounded-lg border border-subtle bg-surface p-3">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated-2">
					<Icon name="file-text" className="size-5 text-tertiary" />
				</span>
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="m-0 truncate label-md text-primary">{csvExport.title}</span>
					<span className="m-0 body-sm text-secondary">CSV exports require a subscription</span>
				</span>
				<Button as="a" href="https://defillama.com/subscription" size="md" variant="primary">
					Subscribe
				</Button>
			</div>
		)
	}

	return (
		<a
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
			className="flex items-center gap-3 rounded-lg border border-subtle bg-surface p-3 not-disabled:not-aria-disabled:hover:bg-hover-row"
		>
			<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-muted">
				<Icon name="file-text" className="size-5 text-link-on-tint" />
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="m-0 truncate label-md text-primary">{csvExport.title}</span>
				<span className="m-0 body-sm text-secondary">{formatNumber(csvExport.rowCount)} rows</span>
			</span>
			<span className="flex shrink-0 items-center gap-1 label-sm text-link">
				<Icon name="download-paper" className="size-3.5" />
				.csv
			</span>
		</a>
	)
}
