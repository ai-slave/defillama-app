import * as Ariakit from '@ariakit/react'
import { type ChangeEvent, type FormEvent, useRef, useState, useSyncExternalStore } from 'react'
import { useAuthContext } from '~/auth'
import { isWalletEmail } from '~/containers/Account/utils'
import { useIsClient } from '~/hooks/useIsClient'
import {
	NEWSLETTERS,
	type NewsletterKey,
	shouldShowNewsletterSignup,
	useNewsletterSubscription
} from '~/hooks/useNewsletterSubscription'
import { Button } from '~/ui/Button'
import { Field, FieldGroup } from '~/ui/Field'
import { keepFocus, pageContent, showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { Switch } from '~/ui/Switch'
import { Tooltip } from '~/ui/Tooltip'
import { emailError } from '~/utils/email'

interface NewsletterSignupProps {
	layout: 'card' | 'strip'
	className?: string
}

const NEWSLETTER_DISMISSED_KEY = 'newsletter-signup-dismissed'

const readNewsletterDismissed = (): boolean => {
	if (typeof window === 'undefined') return false
	try {
		return window.localStorage.getItem(NEWSLETTER_DISMISSED_KEY) != null
	} catch {
		return false
	}
}

const persistNewsletterDismissed = (): void => {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(NEWSLETTER_DISMISSED_KEY, '1')
	} catch {
		// Storage can be unavailable or full; the feature degrades silently.
	}
}

const subscribeToStorage = (onChange: () => void) => {
	if (typeof window === 'undefined') return () => {}
	window.addEventListener('storage', onChange)
	return () => window.removeEventListener('storage', onChange)
}

export function NewsletterSignup({ layout, className }: NewsletterSignupProps) {
	const isClient = useIsClient()
	const { user } = useAuthContext()
	const mutation = useNewsletterSubscription()
	const persistedDismissed = useSyncExternalStore(subscribeToStorage, readNewsletterDismissed, () => false)

	const accountEmail =
		user?.email && isWalletEmail(user.email) ? ((user.ethereum_email as string | undefined) ?? '') : (user?.email ?? '')

	const [email, setEmail] = useState(accountEmail)
	const [prevAccountEmail, setPrevAccountEmail] = useState(accountEmail)
	const [touched, setTouched] = useState(false)
	const [submitted, setSubmitted] = useState(false)
	const [selected, setSelected] = useState<Record<NewsletterKey, boolean>>({ newsletter: true, research: true })
	const [succeeded, setSucceeded] = useState(false)
	const [dismissed, setDismissed] = useState(false)
	const emailRef = useRef<HTMLInputElement>(null)

	if (accountEmail !== prevAccountEmail) {
		setPrevAccountEmail(accountEmail)
		if (!touched) setEmail(accountEmail)
	}

	const isPending = mutation.isPending
	const selectedKeys = NEWSLETTERS.map((n) => n.key).filter((key) => selected[key])
	const emailMessage = emailError(email)
	const listMessage = selectedKeys.length === 0 ? 'Choose at least one newsletter.' : null

	const toggle = (key: NewsletterKey) => setSelected((s) => ({ ...s, [key]: !s[key] }))
	const onEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
		setEmail(e.target.value)
		setTouched(true)
	}
	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (isPending) return
		if (emailMessage || listMessage) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		mutation.mutate(
			{ email: email.trim(), newsletters: selectedKeys },
			{
				onSuccess: (data) => {
					if (selectedKeys.every((key) => data.result?.[key] === 'ok')) {
						setSucceeded(true)
						setSubmitted(false)
						persistNewsletterDismissed()
					}
				}
			}
		)
	}
	// Dismissing removes the whole strip, so focus moves on to the page content.
	const handleDismiss = () =>
		keepFocus(() => {
			persistNewsletterDismissed()
			setDismissed(true)
		}, pageContent)
	// Manage newsletters swaps the success pane back to the form; the email field takes the focus it held.
	const handleReset = () =>
		keepFocus(
			() => setSucceeded(false),
			() => emailRef.current
		)

	if (!isClient || !shouldShowNewsletterSignup(user)) return null

	if (layout === 'strip') {
		if (persistedDismissed || dismissed) return null
		return (
			<div
				className={`@container relative shrink-0 overflow-hidden rounded-xl border border-medium bg-surface py-4 pr-10 pl-6 @5xl:py-5 @5xl:pr-12${
					className ? ` ${className}` : ''
				}`}
			>
				<div aria-hidden className="pointer-events-none absolute top-0 bottom-0 left-0 w-[3px] bg-brand" />
				<Tooltip
					content="Dismiss"
					render={
						<Button
							variant="ghost"
							size="sm"
							square
							onClick={handleDismiss}
							aria-label="Dismiss newsletter signup"
							className="absolute top-2 right-2"
						/>
					}
				>
					<Icon name="x" className="size-4" />
				</Tooltip>
				{succeeded ? (
					<NewsletterSuccess layout="strip" email={email} onReset={handleReset} />
				) : (
					<div className="flex flex-col gap-4 @5xl:flex-row @5xl:items-center @5xl:justify-between @5xl:gap-8">
						<div className="flex min-w-0 flex-col gap-1">
							<span className="flex items-start gap-2 title-lg text-primary">
								<span className="flex h-lh shrink-0 items-center">
									<Icon name="mail" height={20} width={20} className="text-link" />
								</span>
								Get DefiLlama in your inbox
							</span>
							<span className="max-w-md body-md text-secondary">
								Onchain data insights and DeFi tips, plus in-depth research reports.
							</span>
						</div>
						{/* The fields share subgrid rows (label, control, error), so an error under one field never moves the
						    controls beside it. From @sm the email and Subscribe share a row under the chips; from @2xl, where
						    all three fit without wrapping the chips, they share one row. */}
						<form
							noValidate
							onSubmit={handleSubmit}
							className="flex flex-col gap-3 @sm:grid @sm:grid-cols-[minmax(0,1fr)_auto] @sm:grid-rows-[auto_auto_auto_auto] @sm:gap-x-3 @sm:gap-y-1 @2xl:grid-cols-[auto_minmax(0,14rem)_auto] @2xl:grid-rows-[auto_auto_auto] @2xl:justify-start @5xl:shrink-0"
						>
							<FieldGroup
								label="Send me"
								error={submitted ? listMessage : null}
								className="@sm:col-span-2 @sm:mb-2 @2xl:col-span-1 @2xl:row-span-3 @2xl:mb-0 @2xl:grid @2xl:grid-rows-subgrid"
							>
								<div className="flex flex-wrap items-center gap-2">
									{NEWSLETTERS.map(({ key, label }) => {
										const on = selected[key]
										return (
											<Ariakit.Checkbox
												key={key}
												render={
													<Button
														variant="toggle"
														size="md"
														data-active={on}
														stateIcon
														aria-label={`Subscribe to ${label}`}
													/>
												}
												checked={on}
												onChange={() => toggle(key)}
												disabled={isPending}
											>
												{label.replace('DefiLlama ', '')}
											</Ariakit.Checkbox>
										)
									})}
								</div>
							</FieldGroup>
							<Field
								label="Email"
								error={submitted ? emailMessage : null}
								className="@sm:row-span-3 @sm:grid @sm:grid-rows-subgrid"
							>
								{(control) => (
									<Input
										{...control}
										ref={emailRef}
										type="email"
										required
										value={email}
										onChange={onEmailChange}
										placeholder="you@example.com"
									/>
								)}
							</Field>
							<Button
								type="submit"
								variant="primary"
								size="md"
								pendingLabel={isPending ? 'Subscribing…' : null}
								className="@sm:col-start-2 @sm:row-start-3 @2xl:col-start-3 @2xl:row-start-2"
							>
								Subscribe
								<Icon name="arrow-right" className="size-3.5" />
							</Button>
						</form>
					</div>
				)}
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4">
			<div className="flex items-center gap-2">
				<Icon name="mail" height={28} width={28} className="text-primary" />
				<span className="label-lg text-primary">Newsletters</span>
			</div>

			{succeeded ? (
				<NewsletterSuccess layout="card" email={email} onReset={handleReset} />
			) : (
				<form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
					<Field label="Subscribing as" error={submitted ? emailMessage : null}>
						{(control) => (
							<Input
								{...control}
								ref={emailRef}
								type="email"
								required
								value={email}
								onChange={onEmailChange}
								placeholder="you@example.com"
							/>
						)}
					</Field>

					<FieldGroup label="Send me" error={submitted ? listMessage : null}>
						<div className="flex flex-col gap-4">
							{NEWSLETTERS.map(({ key, label, description }) => (
								<div key={key} className="flex flex-col gap-1">
									<div className="flex items-center justify-between gap-4">
										<span className="body-md text-primary">{label}</span>
										<Switch
											label={`Subscribe to ${label}`}
											hideLabel
											value={key}
											checked={selected[key]}
											onChange={() => toggle(key)}
											disabled={isPending}
										/>
									</div>
									<p className="max-w-[400px] body-sm text-tertiary">{description}</p>
								</div>
							))}
						</div>
					</FieldGroup>

					<Button
						type="submit"
						variant="primary"
						size="md"
						pendingLabel={isPending ? 'Subscribing…' : null}
						className="w-fit"
					>
						Subscribe
					</Button>
				</form>
			)}
		</div>
	)
}

function NewsletterSuccess({
	layout,
	email,
	onReset
}: {
	layout: 'card' | 'strip'
	email: string
	onReset: () => void
}) {
	if (layout === 'strip') {
		return (
			<div role="status" className="flex items-start gap-2 body-md text-primary">
				<span className="flex h-lh shrink-0 items-center">
					<Icon name="check-circle" height={20} width={20} className="text-link" />
				</span>
				<span>Subscribed to selected newsletters.</span>
			</div>
		)
	}

	return (
		<div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
			<div className="flex size-12 items-center justify-center rounded-full bg-brand-faint">
				<Icon name="check-circle" height={28} width={28} className="text-link" />
			</div>
			<div className="flex flex-col gap-1">
				<span className="label-lg text-primary">You are subscribed</span>
				<p className="max-w-[360px] body-sm text-tertiary">
					<span className="font-medium">{email}</span> is subscribed to the selected newsletters.
				</p>
			</div>
			<p className="body-sm">
				<Button variant="link" onClick={onReset}>
					Manage newsletters
				</Button>
			</p>
		</div>
	)
}
