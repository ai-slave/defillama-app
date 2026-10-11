import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { useDialogLeave } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

interface SqlHandoffPanelProps {
	onOpenSqlEditor: () => void
}

export function SqlHandoffPanel({ onOpenSqlEditor }: SqlHandoffPanelProps) {
	// Saving from the editor closes Add card too, so a draft in another tab is confirmed before the editor opens.
	const leave = useDialogLeave()
	return (
		<Card padding="md" className="mx-auto flex w-full max-w-md flex-col items-start gap-3">
			<h3 className="title-lg text-primary">SQL cards are built in the SQL editor</h3>
			<p className="body-md text-secondary">
				The editor gives you the schema browser, ready-made examples and live results while you write the query.
			</p>
			<p className="body-md text-secondary">
				When the query returns what you want, add it to this dashboard without leaving the editor.
			</p>
			<Button onClick={() => leave(onOpenSqlEditor)} variant="primary" size="md">
				<Icon name="code" className="size-3.5" />
				Open SQL editor
			</Button>
		</Card>
	)
}
