import * as Ariakit from '@ariakit/react'
import { useAuthContext } from '~/auth'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { useIsClient } from '~/hooks/useIsClient'

/** A projects page while signed out; signed in, the LlamaAI shell renders the page itself. The sign-in stays mounted
    through every auth state, so a sign-in from another tab ends on its own step instead of vanishing. */
export function ProjectsSignInGate() {
	const isClient = useIsClient()
	const { user, loaders } = useAuthContext()
	const signInDialogStore = Ariakit.useDialogStore()
	return (
		<>
			{isClient && !loaders.userLoading && !user ? (
				<div className="isolate flex flex-1 flex-col items-center justify-center rounded-md border border-medium bg-surface p-1">
					<p className="flex items-center gap-1 text-center">
						<button type="button" onClick={signInDialogStore.show} className="underline">
							Sign in
						</button>{' '}
						to access this page.
					</p>
				</div>
			) : null}
			<SignInModal store={signInDialogStore} />
		</>
	)
}
