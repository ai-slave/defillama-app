import { Button } from '~/ui/Button'
import { useDialogLeave } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

interface SqlHandoffPanelProps {
	onOpenSqlEditor: () => void
}

export function SqlHandoffPanel({ onOpenSqlEditor }: SqlHandoffPanelProps) {
	// Saving from the editor closes Add card too, so a draft in another tab is confirmed before the editor opens.
	const leave = useDialogLeave()
	return (
		<div className="mx-auto flex w-full max-w-md flex-col items-start gap-3 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="text-base font-semibold text-pro-text-primary">SQL cards are built in the SQL editor</h3>
			<p className="text-sm text-pro-text-secondary">
				The editor gives you the schema browser, ready-made examples and live results while you write the query.
			</p>
			<p className="text-sm text-pro-text-secondary">
				When the query returns what you want, add it to this dashboard without leaving the editor.
			</p>
			<Button onClick={() => leave(onOpenSqlEditor)} variant="primary" size="md">
				<Icon name="code" className="size-3.5" />
				Open SQL editor
			</Button>
		</div>
	)
}
