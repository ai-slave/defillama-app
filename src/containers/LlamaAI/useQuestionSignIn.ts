import * as Ariakit from '@ariakit/react'
import { useRef, useState } from 'react'
import { clearPendingPrompt } from '~/containers/LlamaAI/pendingPrompt'

/**
 * The sign-in dialog for a question waiting in the handover to /ai/chat. Closing it without signing in drops the
 * question, so it never sends itself on a later visit. Spread `dialogProps` into SignInDialog or SignInModal.
 */
export function useQuestionSignIn(onAuthenticated?: () => void) {
	const authenticatedRef = useRef(false)
	const [question, setQuestion] = useState<string | null>(null)
	const store = Ariakit.useDialogStore({
		setOpen: (open) => {
			if (!open && !authenticatedRef.current) clearPendingPrompt()
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
			onAuthenticated: () => {
				authenticatedRef.current = true
				onAuthenticated?.()
			}
		}
	}
}
