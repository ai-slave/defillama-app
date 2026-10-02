import * as Ariakit from '@ariakit/react'
import { useAuthContext } from '~/auth'
import { SignInDialog } from '~/containers/Subscription/SignInDialog'

export function SignInModal({
	text,
	className,
	hideWhenAuthenticated = true,
	store,
	prompt,
	question,
	onAuthenticated
}: {
	text?: string
	className?: string
	hideWhenAuthenticated?: boolean
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

	if (loaders.userLoading) return null
	if (hideWhenAuthenticated && isAuthenticated) return null

	return (
		<>
			{shouldRenderTrigger ? (
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
