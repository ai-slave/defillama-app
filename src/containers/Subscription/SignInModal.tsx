import * as Ariakit from '@ariakit/react'
import type { ReactElement } from 'react'
import { useAuthContext } from '~/auth'
import { SignInDialog } from '~/containers/Subscription/SignInDialog'

export function SignInModal({
	trigger,
	store,
	prompt,
	question,
	onAuthenticated
}: {
	/** The control that opens the dialog, such as `<Button size="md">Sign in</Button>`; it hides while signed in. */
	trigger?: ReactElement
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

	// Only the trigger hides; an open dialog stays until it closes, so a sign-in from another tab ends on its own step
	// instead of vanishing while the new session's user loads.
	const hideTrigger = loaders.userLoading || isAuthenticated

	return (
		<>
			{trigger && !hideTrigger ? <Ariakit.DialogDisclosure store={dialogStore} render={trigger} /> : null}
			{isOpen ? (
				<SignInDialog store={dialogStore} prompt={prompt} question={question} onAuthenticated={onAuthenticated} />
			) : null}
		</>
	)
}
