import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { BasicLink } from '~/components/Link'
import { Button, StableLabel } from '~/ui/Button'
import { pageContent, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { ErrorLine } from '~/ui/Status'
import { httpErrorMessage } from '~/utils/async'
import type { Dashboard } from '../dashboardTypes'
import { dashboardUrlKey } from '../services/DashboardAPI'

// One button for both modes: Edit and Done swap in place, so the element that had focus keeps it through the route
// change. Two buttons would unmount the pressed one and drop focus to the page.
export function EditDoneButton({
	editing,
	href,
	onDone,
	refreshingSql
}: {
	editing: boolean
	href: string
	onDone: () => void
	/** Done waits while the dashboard's SQL cards refresh. */
	refreshingSql: boolean
}) {
	const router = useRouter()
	// Not the mutation's own error, which clears as soon as a retry starts: the line stays until the editor opens.
	const [navigationFailed, setNavigationFailed] = useState(false)
	const navigation = useMutation({
		mutationFn: () => router.push(href, undefined, { shallow: true }),
		onError: () => setNavigationFailed(true),
		onSuccess: () => setNavigationFailed(false)
	})
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<Button
				type="button"
				variant="primary"
				size="md"
				pendingLabel={editing ? 'Refreshing SQL…' : 'Opening editor…'}
				pending={editing ? refreshingSql : navigation.isPending}
				onClick={editing ? onDone : () => navigation.mutate()}
			>
				<Icon name={editing ? 'check' : 'pencil'} className="size-3.5" />
				<StableLabel labels={['Edit', 'Done']} current={editing ? 'Done' : 'Edit'} />
			</Button>
			{!editing && navigationFailed ? (
				<ErrorLine inset="none">Couldn&apos;t open the editor. Press Edit to try again.</ErrorLine>
			) : null}
		</div>
	)
}

export function CopyDashboardButton({
	onCopy,
	onLimitReached
}: {
	onCopy: () => Promise<Dashboard>
	onLimitReached?: () => void
}) {
	const router = useRouter()
	const buttonRef = useRef<HTMLButtonElement>(null)
	// Not the mutation's own error, which clears as soon as a retry starts.
	const [copyError, setCopyError] = useState<string | null>(null)
	const copy = useMutation({
		mutationFn: onCopy,
		onError: (error) => {
			const message = httpErrorMessage(error, "Couldn't copy the dashboard.")
			setCopyError(message)
			if (!buttonRef.current?.isConnected) toast.error(message)
		},
		onSuccess: () => setCopyError(null)
	})
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<Button
				doneLabel="Copied"
				done={copy.isSuccess}
				type="button"
				variant="primary"
				size="md"
				ref={buttonRef}
				pendingLabel="Copying…"
				pending={copy.isPending}
				accessibleWhenDisabled
				disabled={copy.isSuccess}
				onClick={() => {
					if (copy.isPending || copy.isSuccess) return
					if (onLimitReached) return onLimitReached()
					copy.mutate(undefined, {
						onSuccess: (dashboard) => {
							void router.push(`/pro/${dashboardUrlKey(dashboard)}`).catch(() => {
								toast.error('Dashboard copied, but navigation failed. Use Open copy to open it.')
							})
						}
					})
				}}
			>
				<Icon name="copy" className="size-3.5" />
				Copy Dashboard
			</Button>
			<span role="status" className="sr-only">
				{copy.isPending ? 'Copying dashboard' : copy.isSuccess ? 'Dashboard copied' : ''}
			</span>
			{copy.isSuccess ? (
				<BasicLink href={`/pro/${dashboardUrlKey(copy.data)}`} className="body-md text-secondary underline">
					Open copy
				</BasicLink>
			) : null}
			{copyError ? (
				<div className="max-w-xs">
					<ErrorLine inset="none">{copyError}</ErrorLine>
				</div>
			) : null}
		</div>
	)
}

// A finished undo removes the button with the AI changes; focus that was on it goes to the page, not the body.
const focusPageOnLeave = passFocusOnLeave(() => pageContent())

export function UndoAIGenerationButton({ onUndo }: { onUndo: () => Promise<void> }) {
	const buttonRef = useRef<HTMLButtonElement>(null)
	// Not the mutation's own error, which clears as soon as a retry starts.
	const [undoError, setUndoError] = useState<string | null>(null)
	const undo = useMutation({
		mutationFn: onUndo,
		onError: (error) => {
			const message = httpErrorMessage(error, "Couldn't undo the AI changes.")
			setUndoError(message)
			if (!buttonRef.current?.isConnected) toast.error(message)
		},
		onSuccess: () => setUndoError(null)
	})
	return (
		<div ref={focusPageOnLeave} className="flex min-w-0 flex-col gap-1">
			<Button
				type="button"
				variant="secondary"
				size="md"
				pendingLabel="Undoing…"
				pending={undo.isPending}
				ref={buttonRef}
				onClick={() => undo.mutate()}
			>
				<Icon name="arrow-left" className="size-3.5" />
				Undo AI changes
			</Button>
			<span role="status" className="sr-only">
				{undo.isPending ? 'Undoing AI changes' : ''}
			</span>
			{undoError ? (
				<div className="max-w-xs">
					<ErrorLine inset="none">{undoError}</ErrorLine>
				</div>
			) : null}
		</div>
	)
}
