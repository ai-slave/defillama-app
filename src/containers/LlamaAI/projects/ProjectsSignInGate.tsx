import * as Ariakit from '@ariakit/react'
import { useAuthContext } from '~/auth'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { ClientOnly } from '~/layout/ClientOnly'
import { Button } from '~/ui/Button'
import { EmptyState } from '~/ui/Status'

/** A projects page while signed out; signed in, the LlamaAI shell renders the page itself. The sign-in stays mounted
    through every auth state, so a sign-in from another tab ends on its own step instead of vanishing. */
export function ProjectsSignInGate() {
	const { user, loaders } = useAuthContext()
	const signInDialogStore = Ariakit.useDialogStore()
	return (
		<>
			{!loaders.userLoading && !user ? (
				<ClientOnly>
					<EmptyState
						size="lg"
						icon="folder-plus"
						title="Projects need an account"
						headingAs="h1"
						actions={
							<Button size="md" variant="primary" onClick={signInDialogStore.show}>
								Sign in
							</Button>
						}
					>
						Sign in to upload files or connect a GitHub repo, then chat with LlamaAI using that knowledge.
					</EmptyState>
				</ClientOnly>
			) : null}
			<SignInModal store={signInDialogStore} />
		</>
	)
}
