import * as Ariakit from '@ariakit/react'
import { useAuthContext } from '~/auth'
import { SignInDialog } from '~/containers/Subscription/SignInDialog'

export function SignInModal({
	text,
	className,
	hideWhenAuthenticated = true,
	store,
	prompt
}: {
	text?: string
	className?: string
	hideWhenAuthenticated?: boolean
	store?: Ariakit.DialogStore
	prompt?: string
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
				<button type="button" className={className} onClick={dialogStore.show} suppressHydrationWarning>
					{text ?? 'Sign In'}
				</button>
			) : null}
			{isOpen ? <SignInDialog store={dialogStore} prompt={prompt} /> : null}
		</>
	)
}
