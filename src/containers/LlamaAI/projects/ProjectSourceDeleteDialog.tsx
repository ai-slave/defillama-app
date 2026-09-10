import type { UseMutationResult } from '@tanstack/react-query'
import { useRef, type RefObject } from 'react'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'

// The parent mounts this dialog only for the current target and removes it on close.
export function ProjectSourceDeleteDialog({
	target,
	mutation,
	fallbackFocus,
	onClose
}: {
	target: { kind: 'file' | 'source'; id: string; name: string; trigger: HTMLButtonElement }
	mutation: UseMutationResult<void, Error, string>
	fallbackFocus: RefObject<HTMLButtonElement | null>
	onClose: () => void
}) {
	// A successful deletion removes the trigger, so focus is redirected to the add button before the
	// dialog hides; a cancel still returns to the trigger.
	const returnFocus = useRef<HTMLElement | null>(target.trigger)
	const action = target.kind === 'file' ? 'Delete' : 'Disconnect'
	return (
		<ConfirmActionDialog
			title={`${action} ${target.name}?`}
			description={
				target.kind === 'file'
					? 'This removes the file from this project. Upload it again to restore it.'
					: 'This removes the source and its files from this project. The GitHub repository stays unchanged.'
			}
			confirmLabel={action}
			pendingLabel={target.kind === 'file' ? 'Deleting…' : 'Disconnecting…'}
			mutation={mutation}
			variables={target.id}
			onClose={onClose}
			onSuccess={() => {
				returnFocus.current = fallbackFocus.current
			}}
			finalFocus={returnFocus}
			fallbackFocus={fallbackFocus}
		/>
	)
}
