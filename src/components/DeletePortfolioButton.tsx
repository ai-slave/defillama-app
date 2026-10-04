import { useState, type RefObject } from 'react'
import { DEFAULT_PORTFOLIO_NAME } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Icon } from '~/ui/Icon'

/** The watchlists' Delete for the selected portfolio. It asks first, because the portfolio and every bookmark in it go
    at once with no undo. The dialog stays mounted while Delete leaves with the portfolio, and closes onto
    `finalFocus` (the toolbar's New button), since the selection falls back to the default portfolio, which has no
    Delete. */
export function DeletePortfolioButton({
	portfolio,
	onDelete,
	finalFocus,
	umamiEvent
}: {
	portfolio: string
	onDelete: (portfolio: string) => void
	finalFocus: RefObject<HTMLElement | null>
	umamiEvent?: string
}) {
	// The portfolio stays after closing, so the dialog still names it while it fades out.
	const [confirm, setConfirm] = useState({ open: false, portfolio, deleted: false })
	return (
		<>
			{portfolio !== DEFAULT_PORTFOLIO_NAME ? (
				<Button
					type="button"
					variant="destructive"
					size="md"
					onClick={() => setConfirm({ open: true, portfolio, deleted: false })}
					data-umami-event={umamiEvent}
				>
					<Icon name="trash-2" className="size-3.5" />
					<span>Delete</span>
				</Button>
			) : null}
			<ConfirmDialog
				open={confirm.open}
				onClose={() => setConfirm({ ...confirm, open: false })}
				unmountOnHide
				portal
				// A cancel returns to Delete; a delete removes it with the portfolio, so New takes focus.
				finalFocus={confirm.deleted ? finalFocus : undefined}
				title="Delete portfolio?"
				description={`"${confirm.portfolio}" and everything saved in it are removed. This cannot be undone.`}
				confirmLabel="Delete"
				pendingLabel={null}
				error={null}
				onConfirm={() => {
					onDelete(confirm.portfolio)
					setConfirm({ ...confirm, open: false, deleted: true })
				}}
			/>
		</>
	)
}
