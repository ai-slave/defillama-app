import { useMutation } from '@tanstack/react-query'
import Script from 'next/script'
import * as React from 'react'
import { useUserHash } from '~/auth'
import Layout from '~/layout'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input, Textarea } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { InlineStatus } from '~/ui/Status'
import { emailError } from '~/utils/email'

const EMPTY_REQUEST = { name: '', email: '', body: '' }

async function submitSupportRequest(formData: FormData) {
	const data = await fetch('https://api.llama.fi/reportSupport', {
		method: 'POST',
		body: formData
	}).then((res) => res.json())
	if (data?.message !== 'success') throw new Error('Failed to submit support request')
}

function LiveChatCard({ userHash, email }: { userHash: string | null; email: string | null }) {
	const [ready, setReady] = React.useState(false)
	const [loading, setLoading] = React.useState(false)
	const initialized = React.useRef(false)

	const openLiveChat = () => {
		if (!ready || !userHash) return
		const frontChat = (window as any).FrontChat
		if (!frontChat) return

		if (initialized.current) {
			frontChat('show')
			return
		}

		setLoading(true)
		initialized.current = true
		;(window as any).__frontChatUserHash = userHash
		frontChat('init', {
			chatId: '6fec3ab74da2261df3f3748a50dd3d6a',
			shouldShowWindowOnLaunch: true,
			shouldExpandOnShowWindow: true,
			onInitCompleted: () => {
				setLoading(false)
				frontChat('show')
			},
			email,
			userHash
		})
	}

	return (
		<>
			{userHash ? (
				<Script
					src="/assets/front-chat.js"
					id="front-chat-sdk"
					strategy="afterInteractive"
					onReady={() => setReady(true)}
				/>
			) : null}
			<Card
				padding="md"
				as="button"
				type="button"
				onClick={openLiveChat}
				disabled={!userHash || loading}
				className="group hover-wash-card flex cursor-pointer flex-col gap-1 text-center disabled:cursor-not-allowed"
			>
				<span className="flex items-center justify-center gap-2 font-semibold group-disabled:text-disabled">
					{loading ? (
						<>
							<LoadingSpinner size={16} />
							Opening Chat…
						</>
					) : (
						'Live Chat'
					)}
				</span>
				<span className="body-sm text-secondary">
					{loading ? 'Please wait' : userHash ? 'Chat with us in real time' : 'Available for paying customers'}
				</span>
			</Card>
		</>
	)
}

function Support() {
	const { mutate, isPending } = useMutation({ mutationFn: submitSupportRequest })
	const [isSubmitted, setIsSubmitted] = React.useState(false)
	const [showForm, setShowForm] = React.useState(false)
	const [request, setRequest] = React.useState(EMPTY_REQUEST)
	const [submitted, setSubmitted] = React.useState(false)
	// Kept while a retry runs: the mutation clears its own error when the retry starts.
	const [failed, setFailed] = React.useState(false)
	const errors = {
		// The email is optional; a malformed one would leave the team no way to reply.
		email: request.email.trim() ? emailError(request.email) : null,
		body: request.body.trim() ? null : 'Enter a description of the issue.'
	}
	const edit = (field: keyof typeof EMPTY_REQUEST) => (e: { target: { value: string } }) =>
		setRequest((current) => ({ ...current, [field]: e.target.value }))

	const onSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		if (isPending) return
		if (errors.email || errors.body) return showFieldErrors(e.currentTarget, () => setSubmitted(true))

		const formData = new FormData()
		formData.set('name', request.name)
		formData.set('email', request.email.trim() || 'anon@defillama.com')
		formData.set('body', request.body)

		mutate(formData, {
			onSuccess: () => {
				setRequest(EMPTY_REQUEST)
				setSubmitted(false)
				setFailed(false)
				setIsSubmitted(true)
			},
			onError: () => setFailed(true)
		})
	}

	const { userHash, email } = useUserHash()

	return (
		<Layout
			title="Help & Support - DefiLlama DeFi Analytics"
			description="Get help with DefiLlama. Find answers to common questions, report issues, or reach the team via Discord and X/Twitter."
			canonicalUrl="/support"
		>
			<div className="mx-auto flex w-full max-w-lg flex-col gap-4 lg:mt-4 xl:mt-11 xl:ml-[calc(228px-16px)]">
				<h1 className="text-center heading-sm">Support</h1>

				<div className="flex flex-col gap-3">
					<Card
						as="a"
						padding="md"
						href="mailto:support@defillama.com"
						className="hover-wash-card flex flex-col gap-1 text-center"
					>
						<span className="font-semibold">Email Us</span>
						<span className="body-sm text-secondary">support@defillama.com</span>
					</Card>

					<Card
						padding="md"
						as="button"
						type="button"
						onClick={() => setShowForm((p) => !p)}
						className="hover-wash-card flex cursor-pointer flex-col gap-1 text-center"
					>
						<span className="font-semibold">Submit a Form</span>
						<span className="body-sm text-secondary">Don't want to share your email? Use our anonymous form</span>
					</Card>

					{/* Keyed by the signed-in user: signing out unmounts the card, so the next session starts with
					    the SDK uninitialised instead of reusing a chat the sign-out already tore down. */}
					<LiveChatCard key={userHash ?? 'signed-out'} userHash={userHash} email={email} />
				</div>

				{showForm ? (
					isSubmitted ? (
						<SuccessScreen setIsSubmitted={setIsSubmitted} />
					) : (
						<Card as="form" noValidate onSubmit={onSubmit} padding="sm" className="flex w-full flex-col gap-4">
							<Field label="Name (optional)">
								{(control) => (
									<Input {...control} type="text" value={request.name} onChange={edit('name')} className="w-full" />
								)}
							</Field>

							<Field label="Email (optional)" error={submitted ? errors.email : null}>
								{(control) => (
									<Input {...control} type="email" value={request.email} onChange={edit('email')} className="w-full" />
								)}
							</Field>

							<Field label="Description" error={submitted ? errors.body : null}>
								{(control) => (
									<Textarea
										{...control}
										required
										value={request.body}
										onChange={edit('body')}
										className="min-h-24 w-full"
									/>
								)}
							</Field>

							<Button
								type="submit"
								variant="primary"
								size="md"
								pendingLabel="Submitting…"
								pending={isPending}
								className="mt-3 w-full"
							>
								Submit
							</Button>
							{failed ? (
								<InlineStatus variant="error">
									Your request didn't send. Try again, or email support@defillama.com.
								</InlineStatus>
							) : null}
						</Card>
					)
				) : null}

				<p className="text-center body-sm text-secondary">
					Contacting us via these channels ensures a much faster response compared to discord
				</p>
			</div>
		</Layout>
	)
}

export default Support

function SuccessScreen({ setIsSubmitted }: { setIsSubmitted: (isSubmitted: boolean) => void }) {
	return (
		<Card padding="md" className="flex w-full flex-col gap-4 text-center">
			<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success-tint-strong">
				<svg
					className="size-8 text-success"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
				</svg>
			</div>
			<h2 className="heading-xs text-success">Request sent</h2>
			<p className="text-secondary">
				Your support request has been submitted successfully. We'll get back to you as soon as possible.
			</p>
			<Button variant="primary" size="md" onClick={() => setIsSubmitted(false)} className="mt-4 w-full">
				Submit Another Request
			</Button>
		</Card>
	)
}
