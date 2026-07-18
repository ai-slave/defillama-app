import { useAuthContext } from '~/auth'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

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
			<div className="flex items-center gap-3 rounded-lg border border-ai-line bg-ai-surface-card p-3 opacity-60">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ai-skeleton">
					<Icon name="file-text" className="size-5 text-ai-muted" />
				</span>
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="m-0 truncate text-sm font-medium text-(--text1)">{csvExport.title}</span>
					<span className="m-0 text-xs text-(--text3)">CSV exports require a subscription</span>
				</span>
				<a
					href="https://defillama.com/subscription"
					className="flex shrink-0 items-center gap-1.5 rounded-md bg-ai-action px-2.5 py-1 text-xs font-medium text-ai-white hover:bg-ai-action-hover"
				>
					Subscribe
				</a>
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
			className="flex items-center gap-3 rounded-lg border border-ai-line bg-ai-surface-card p-3 transition-colors hover:border-ai-action hover:bg-ai-action/5"
		>
			<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ai-action/10">
				<Icon name="file-text" className="size-5 text-ai-action" />
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="m-0 truncate text-sm font-medium text-(--text1)">{csvExport.title}</span>
				<span className="m-0 text-xs text-(--text3)">{csvExport.rowCount.toLocaleString()} rows</span>
			</span>
			<span className="flex shrink-0 items-center gap-1.5 text-ai-action">
				<Icon name="download-paper" className="size-4" />
				<span className="text-sm font-medium">.csv</span>
			</span>
		</a>
	)
}
