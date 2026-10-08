import * as Ariakit from '@ariakit/react'
import { type ChangeEvent, type FormEvent, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useAuthContext } from '~/auth'
import { ToggleSwitch } from '~/containers/Account/ToggleSwitch'
import { isWalletEmail } from '~/containers/Account/utils'
import { useIsClient } from '~/hooks/useIsClient'
import {
	NEWSLETTERS,
	type NewsletterKey,
	shouldShowNewsletterSignup,
	useNewsletterSubscription
} from '~/hooks/useNewsletterSubscription'
import { Button } from '~/ui/Button'
import { keepFocus, pageContent } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { Tooltip } from '~/ui/Tooltip'

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
	const helperId = useId()
	const persistedDismissed = useSyncExternalStore(subscribeToStorage, readNewsletterDismissed, () => false)

	const accountEmail =
		user?.email && isWalletEmail(user.email) ? ((user.ethereum_email as string | undefined) ?? '') : (user?.email ?? '')

	const [email, setEmail] = useState(accountEmail)
	const [prevAccountEmail, setPrevAccountEmail] = useState(accountEmail)
	const [touched, setTouched] = useState(false)
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
	const noneSelected = selectedKeys.length === 0
	const canSubmit = !isPending && !noneSelected && email.trim().length > 0
	// A disabled Subscribe says why in visible text beside it.
	const disabledReason = noneSelected
		? 'Choose at least one newsletter.'
		: email.trim().length === 0
			? 'Enter an email address.'
			: null

	const toggle = (key: NewsletterKey) => setSelected((s) => ({ ...s, [key]: !s[key] }))
	const onEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
		setEmail(e.target.value)
		setTouched(true)
	}
	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		if (!canSubmit) return
		mutation.mutate(
			{ email: email.trim(), newsletters: selectedKeys },
			{
				onSuccess: (data) => {
					if (selectedKeys.every((key) => data.result?.[key] === 'ok')) {
						setSucceeded(true)
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
				<div aria-hidden className="pointer-events-none absolute top-0 bottom-0 left-0 w-[3px] bg-sub-brand-primary" />
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
						<div className="flex flex-col gap-1">
							<span className="flex items-center gap-2 title-lg text-primary">
								<Icon name="mail-rounded" height={20} width={20} className="shrink-0 text-link" />
								Subscribe to the DefiLlama Newsletter
							</span>
							<span className="max-w-md body-md text-secondary">
								Get DefiLlama's newsletter, Research updates, or both, delivered to your inbox.
							</span>
						</div>
						<form
							onSubmit={handleSubmit}
							className="flex flex-col gap-3 @sm:flex-row @sm:flex-wrap @sm:items-end @5xl:shrink-0 @5xl:justify-end"
						>
							<div className="flex flex-wrap items-center gap-2" role="group" aria-label="Newsletters">
								{NEWSLETTERS.map(({ key, label }) => {
									const on = selected[key]
									return (
										<Ariakit.Checkbox
											key={key}
											render={
												<Button variant="toggle" size="md" data-active={on} aria-label={`Subscribe to ${label}`} />
											}
											checked={on}
											onChange={() => toggle(key)}
											disabled={isPending}
										>
											{on ? <Icon name="check" className="size-3.5" /> : null}
											{label.replace('DefiLlama ', '')}
										</Ariakit.Checkbox>
									)
								})}
							</div>
							<div className="flex flex-col gap-2 @sm:flex-row @sm:items-end">
								<label className="flex min-w-0 flex-col gap-1 @sm:w-56">
									<span className="label-sm text-secondary">Email</span>
									<Input
										ref={emailRef}
										type="email"
										required
										value={email}
										onChange={onEmailChange}
										placeholder="you@example.com"
									/>
								</label>
								<Button
									type="submit"
									variant="primary"
									size="md"
									pendingLabel={isPending ? 'Subscribing…' : null}
									aria-describedby={disabledReason ? helperId : undefined}
									disabled={!canSubmit}
									accessibleWhenDisabled
								>
									Subscribe
									<Icon name="arrow-right" className="size-3.5" />
								</Button>
							</div>
							{disabledReason ? (
								<p id={helperId} className="body-sm text-secondary @sm:basis-full @5xl:text-right">
									{disabledReason}
								</p>
							) : null}
						</form>
					</div>
				)}
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
			<div className="flex items-center gap-2">
				<Icon name="mail-rounded" height={28} width={28} className="text-sub-text-primary" />
				<span className="label-lg text-sub-text-primary">Newsletters</span>
			</div>

			{succeeded ? (
				<NewsletterSuccess layout="card" email={email} onReset={handleReset} />
			) : (
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<label className="flex flex-col gap-1">
						<span className="label-sm text-sub-text-muted">Subscribing as</span>
						<Input
							ref={emailRef}
							type="email"
							required
							value={email}
							onChange={onEmailChange}
							placeholder="you@example.com"
						/>
					</label>

					<div className="flex flex-col gap-4" role="group" aria-label="Newsletters">
						{NEWSLETTERS.map(({ key, label, description }) => (
							<div key={key} className="flex flex-col gap-1">
								<div className="flex items-center justify-between gap-4">
									<span className="body-md text-sub-text-primary">{label}</span>
									<ToggleSwitch
										checked={selected[key]}
										onClick={() => toggle(key)}
										disabled={isPending}
										aria-label={`Subscribe to ${label}`}
									/>
								</div>
								<p className="max-w-[400px] body-sm text-sub-text-muted">{description}</p>
							</div>
						))}
					</div>

					<div className="flex flex-col gap-2">
						<Button
							type="submit"
							variant="primary"
							size="md"
							pendingLabel={isPending ? 'Subscribing…' : null}
							aria-describedby={disabledReason ? helperId : undefined}
							disabled={!canSubmit}
							accessibleWhenDisabled
							className="w-fit"
						>
							Subscribe
						</Button>
						{disabledReason ? (
							<p id={helperId} className="body-sm text-sub-text-muted">
								{disabledReason}
							</p>
						) : null}
					</div>
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
			<div role="status" className="flex items-center gap-2 body-md text-primary">
				<Icon name="check-circle" height={20} width={20} className="shrink-0 text-link" />
				<span>Subscribed to selected newsletters.</span>
			</div>
		)
	}

	return (
		<div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
			<div className="flex size-12 items-center justify-center rounded-full bg-sub-brand-primary/8">
				<Icon name="check-circle" height={28} width={28} className="text-link" />
			</div>
			<div className="flex flex-col gap-1">
				<span className="label-lg text-sub-text-primary">You are subscribed</span>
				<p className="max-w-[360px] body-sm text-sub-text-muted">
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
