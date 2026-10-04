import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useRef } from 'react'
import toast from 'react-hot-toast'
import { BasicLink } from '~/components/Link'
import { pageContent, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import type { Dashboard } from '../dashboardTypes'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { ProButton } from '../ui'

export function EditDashboardButton({ href }: { href: string }) {
	const router = useRouter()
	const navigation = useMutation({ mutationFn: () => router.push(href, undefined, { shallow: true }) })
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<ProButton
				type="button"
				variant="primary"
				icon={<Icon name="pencil" height={16} width={16} />}
				loading={navigation.isPending}
				onClick={() => navigation.mutate()}
			>
				{navigation.isPending ? 'Opening editor…' : 'Edit'}
			</ProButton>
			{navigation.isError ? (
				<p role="alert" className="text-sm text-error">
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
			<ProButton
				type="button"
				variant="primary"
				ref={buttonRef}
				accessibleWhenDisabled
				disabled={copy.isPending || copy.isSuccess}
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
				{copy.isPending ? (
					<LoadingSpinner size={16} />
				) : (
					<Icon name={copy.isSuccess ? 'check' : 'copy'} height={16} width={16} />
				)}
				{copy.isPending ? 'Copying…' : copy.isSuccess ? 'Copied' : 'Copy Dashboard'}
			</ProButton>
			<span role="status" className="sr-only">
				{copy.isPending ? 'Copying dashboard' : copy.isSuccess ? 'Dashboard copied' : ''}
			</span>
			{copy.isSuccess ? (
				<BasicLink href={`/pro/${dashboardUrlKey(copy.data)}`} className="text-sm text-pro-text-secondary underline">
					Open copy
				</BasicLink>
			) : null}
			{copy.error ? (
				<p role="alert" className="max-w-xs text-sm text-error">
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
			<ProButton
				type="button"
				variant="secondary"
				icon={<Icon name="arrow-left" height={16} width={16} />}
				loading={undo.isPending}
				ref={buttonRef}
				onClick={() => undo.mutate()}
				aria-label="Undo AI changes"
			>
				{undo.isPending ? 'Undoing…' : 'Undo AI changes'}
			</ProButton>
			<span role="status" className="sr-only">
				{undo.isPending ? 'Undoing AI changes' : ''}
			</span>
			{undo.error ? (
				<p role="alert" className="max-w-xs text-sm text-error">
					{undo.error.message}
				</p>
			) : null}
		</div>
	)
}
