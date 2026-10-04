import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { clearPendingPrompt } from '~/containers/LlamaAI/pendingPrompt'
import pb from '~/utils/pocketbase'

/**
 * The sign-in dialog for a question waiting in the handover to /ai/chat. Closing it without a session drops the
 * question, so it never sends itself on a later visit. Spread `dialogProps` into SignInDialog or SignInModal.
 */
export function useQuestionSignIn(onAuthenticated?: () => void) {
	const [question, setQuestion] = useState<string | null>(null)
	const store = Ariakit.useDialogStore({
		// Reads the session itself: this runs before the dialog finishes a sign-in from another tab on the same close.
		setOpen: (open) => {
			if (!open && !pb.authStore.isValid) clearPendingPrompt()
		}
	})
	const isOpen = Ariakit.useStoreState(store, 'open')

	return {
		isOpen,
		/** Opens sign-in for a question already handed over, or with no question for a plain sign-in. */
		open: (nextQuestion: string | null) => {
			setQuestion(nextQuestion)
			store.show()
		},
		dialogProps: {
			store,
			question: question ?? undefined,
			onAuthenticated
		}
	}
}
