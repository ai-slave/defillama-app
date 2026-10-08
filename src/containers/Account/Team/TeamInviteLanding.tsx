import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { SignInDialog } from '~/containers/Subscription/SignInDialog'
import { Button } from '~/ui/Button'

export function TeamInviteLanding() {
	const dialogStore = Ariakit.useDialogStore()
	const isOpen = Ariakit.useStoreState(dialogStore, 'open')
	const [initialStep, setInitialStep] = useState<'signin' | 'signup'>('signup')

	const openDialog = (step: 'signin' | 'signup') => {
		setInitialStep(step)
		dialogStore.show()
	}

	return (
		<div className="flex flex-col items-center gap-6 py-16">
			<img src="/assets/account_avatar.png" alt="" className="size-16 rounded-full" />
			<div className="flex flex-col gap-2 text-center">
				<h2 className="heading-sm text-sub-text-primary">You&apos;ve been invited to join a team on DefiLlama</h2>
				<p className="max-w-md body-md text-sub-text-muted">
					Create an account with the email address this invite was sent to and you&apos;ll be added to the team
					automatically.
				</p>
			</div>
			<Button variant="primary" size="md" onClick={() => openDialog('signup')}>
				Sign up & accept
			</Button>
			<p className="body-md text-sub-text-muted">
				Already have an account?{' '}
				<Button variant="link" onClick={() => openDialog('signin')}>
					Sign in
				</Button>
			</p>
			{isOpen ? <SignInDialog store={dialogStore} initialStep={initialStep} suppressVerifyEmailPrompt /> : null}
		</div>
	)
}
