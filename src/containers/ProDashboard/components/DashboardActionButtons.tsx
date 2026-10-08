import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useRef } from 'react'
import toast from 'react-hot-toast'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { pageContent, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import type { Dashboard } from '../dashboardTypes'
import { dashboardUrlKey } from '../services/DashboardAPI'

// One button for both modes: Edit and Done swap in place, so the element that had focus keeps it through the route
// change. Two buttons would unmount the pressed one and drop focus to the page.
export function EditDoneButton({
	editing,
	href,
	onDone,
	donePendingLabel
}: {
	editing: boolean
	href: string
	onDone: () => void
	donePendingLabel: string | null
}) {
	const router = useRouter()
	const navigation = useMutation({ mutationFn: () => router.push(href, undefined, { shallow: true }) })
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<Button
				type="button"
				variant="primary"
				size="md"
				pendingLabel={editing ? donePendingLabel : navigation.isPending ? 'Opening editor…' : null}
				onClick={editing ? onDone : () => navigation.mutate()}
			>
				<Icon name={editing ? 'check' : 'pencil'} height={14} width={14} />
				{editing ? 'Done' : 'Edit'}
			</Button>
			{!editing && navigation.isError ? (
				<p role="alert" className="body-md text-error">
					Could not open the editor. Please try again.
				</p>
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
	const copy = useMutation({
		mutationFn: onCopy,
		onError: (error) => {
			if (!buttonRef.current?.isConnected) toast.error(error.message)
		}
	})
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<Button
				type="button"
				variant="primary"
				size="md"
				ref={buttonRef}
				pendingLabel={copy.isPending ? 'Copying…' : null}
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
				<Icon name={copy.isSuccess ? 'check' : 'copy'} height={14} width={14} />
				{copy.isSuccess ? 'Copied' : 'Copy Dashboard'}
			</Button>
			<span role="status" className="sr-only">
				{copy.isPending ? 'Copying dashboard' : copy.isSuccess ? 'Dashboard copied' : ''}
			</span>
			{copy.isSuccess ? (
				<BasicLink href={`/pro/${dashboardUrlKey(copy.data)}`} className="body-md text-pro-text-secondary underline">
					Open copy
				</BasicLink>
			) : null}
			{copy.error ? (
				<p role="alert" className="max-w-xs body-md text-error">
					{copy.error.message}
				</p>
			) : null}
		</div>
	)
}

// A finished undo removes the button with the AI changes; focus that was on it goes to the page, not the body.
const focusPageOnLeave = passFocusOnLeave(() => pageContent())

export function UndoAIGenerationButton({ onUndo }: { onUndo: () => Promise<void> }) {
	const buttonRef = useRef<HTMLButtonElement>(null)
	const undo = useMutation({
		mutationFn: onUndo,
		onError: (error) => {
			if (!buttonRef.current?.isConnected) toast.error(error.message)
		}
	})
	return (
		<div ref={focusPageOnLeave} className="flex min-w-0 flex-col gap-1">
			<Button
				type="button"
				variant="secondary"
				size="md"
				pendingLabel={undo.isPending ? 'Undoing…' : null}
				ref={buttonRef}
				onClick={() => undo.mutate()}
			>
				<Icon name="arrow-left" height={14} width={14} />
				Undo AI changes
			</Button>
			<span role="status" className="sr-only">
				{undo.isPending ? 'Undoing AI changes' : ''}
			</span>
			{undo.error ? (
				<p role="alert" className="max-w-xs body-md text-error">
					{undo.error.message}
				</p>
			) : null}
		</div>
	)
}
