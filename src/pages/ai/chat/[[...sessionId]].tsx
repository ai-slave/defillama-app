import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useAuthContext } from '~/auth'
import { DeepLinkPromptModal } from '~/containers/LlamaAI/components/DeepLinkPromptModal'
import { LlamaAIShell } from '~/containers/LlamaAI/LlamaAIShell'
import { setPendingEntrySource, setPendingPrompt } from '~/containers/LlamaAI/pendingPrompt'
import { SignInModal } from '~/containers/Subscription/SignInModal'

function LlamaAIPage() {
	const router = useRouter()
	const { user, loaders } = useAuthContext()
	const signInDialogStore = Ariakit.useDialogStore()
	const promptParam = typeof router.query.prompt === 'string' ? router.query.prompt.trim() : ''
	const isSession = Array.isArray(router.query.sessionId) && router.query.sessionId.length === 1
	const cleanUrl = router.asPath.split(/[?#]/)[0]

	// A session link's ?prompt and ?shareToken stay in the URL, through sign-in too: the chat removes them once it sends them.

	if (loaders.userLoading || user) return null

	const handleConfirmDeepLinkPrompt = () => {
		if (!promptParam) return
		setPendingPrompt(promptParam)
		setPendingEntrySource(typeof router.query.utm_source === 'string' ? router.query.utm_source : 'deep-link')
		void router.replace(cleanUrl, undefined, { shallow: true, scroll: false })
		signInDialogStore.show()
	}

	const handleCloseDeepLinkPrompt = () => {
		void router.replace(cleanUrl, undefined, { shallow: true, scroll: false })
	}

	return (
		<>
			<div className="isolate flex flex-1 flex-col items-center justify-center rounded-md border border-medium bg-surface p-1">
				<p className="flex items-center gap-1 text-center">
					Please{' '}
					<button type="button" onClick={signInDialogStore.show} className="underline">
						sign in
					</button>{' '}
					to access this page.
				</p>
			</div>
			<SignInModal store={signInDialogStore} hideWhenAuthenticated={false} />
			<DeepLinkPromptModal
				isOpen={!isSession && !!promptParam}
				prompt={promptParam}
				onClose={handleCloseDeepLinkPrompt}
				onConfirm={handleConfirmDeepLinkPrompt}
			/>
		</>
	)
}

LlamaAIPage.getLayout = LlamaAIShell.getLayout

export default LlamaAIPage
