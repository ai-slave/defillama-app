import * as Ariakit from '@ariakit/react'
import { type NextRouter, useRouter } from 'next/router'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'

/** The subscription page query once the post-sign-in return intent is consumed. */
export function withoutReturnUrl(query: NextRouter['query']): NextRouter['query'] {
	const { returnUrl: _ignoredReturnUrl, ...nextQuery } = query
	return nextQuery
}

/**
 * A signed-in visitor with an unhandled return destination is asked whether to go back, except
 * right after signup, where onboarding takes over and the destination is dropped silently.
 */
export function getReturnIntentAction({
	isAuthenticated,
	userLoading,
	isNewSignup,
	returnUrl,
	handledReturnUrl
}: {
	isAuthenticated: boolean
	userLoading: boolean
	isNewSignup: boolean
	returnUrl: string | undefined
	handledReturnUrl: string | undefined
}): 'none' | 'consume' | 'prompt' {
	if (!isAuthenticated || !returnUrl || handledReturnUrl === returnUrl || userLoading) return 'none'
	return isNewSignup ? 'consume' : 'prompt'
}

interface ReturnModalProps {
	isOpen: boolean
	onClose: () => void
	returnUrl: string
}

export function ReturnModal({ isOpen, onClose, returnUrl }: ReturnModalProps) {
	const router = useRouter()

	const handleClose = () => {
		void router.replace(
			{
				pathname: router.pathname,
				query: withoutReturnUrl(router.query)
			},
			undefined,
			{ shallow: true }
		)
		onClose()
	}
	// A two-choice confirmation: no ×, both choices stay visible at every width; Escape and an outside tap stay.
	return (
		<Dialog size="sm" open={isOpen} onClose={handleClose} portal unmountOnHide>
			<DialogHeader title="Go back to where you were?" closable={false} />
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">
					Would you like to return to the page you were on before signing in?
				</Ariakit.DialogDescription>
			</DialogBody>
			<DialogFooter>
				<Button type="button" size="md" onClick={handleClose}>
					Stay on this page
				</Button>
				<Button as={BasicLink} variant="primary" size="md" href={returnUrl}>
					Take me back
				</Button>
			</DialogFooter>
		</Dialog>
	)
}
