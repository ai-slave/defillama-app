import * as Ariakit from '@ariakit/react'
import { useAuthContext } from '~/auth'
import { SignInDialog } from '~/containers/Subscription/SignInDialog'

export function SignInModal({
	text,
	className,
	store,
	prompt,
	question,
	onAuthenticated
}: {
	text?: string
	className?: string
	store?: Ariakit.DialogStore
	prompt?: string
	question?: string
	/** Runs once sign-in succeeds, before this dialog unmounts, such as to choose where focus returns. */
	onAuthenticated?: () => void
}) {
	const localDialogStore = Ariakit.useDialogStore()
	const dialogStore = store ?? localDialogStore
	const isOpen = Ariakit.useStoreState(dialogStore, 'open')
	const { isAuthenticated, loaders } = useAuthContext()
	const shouldRenderTrigger = text !== undefined || className !== undefined

	// Only the trigger hides; an open dialog stays until it closes, so a sign-in from another tab ends on its own step
	// instead of vanishing while the new session's user loads.
	const hideTrigger = loaders.userLoading || isAuthenticated

	return (
		<>
			{shouldRenderTrigger && !hideTrigger ? (
				<button type="button" className={className} onClick={dialogStore.show}>
					{text ?? 'Sign In'}
				</button>
			) : null}
			{isOpen ? (
				<SignInDialog store={dialogStore} prompt={prompt} question={question} onAuthenticated={onAuthenticated} />
			) : null}
		</>
	)
}
