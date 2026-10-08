import * as Ariakit from '@ariakit/react'
import { type ChangeEvent, type FormEvent, useId, useState } from 'react'
import { useAuthContext } from '~/auth'
import { isWalletEmail } from '~/containers/Account/utils'
import { NEWSLETTERS, type NewsletterKey, useNewsletterSubscription } from '~/hooks/useNewsletterSubscription'
import Layout from '~/layout'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { emailError } from '~/utils/email'

const initialSelected: Record<NewsletterKey, boolean> = {
	newsletter: true,
	research: true
}

const newsletterDetails: Record<
	NewsletterKey,
	{
		eyebrow: string
		description: string
		bestFor: string
		bullets: Array<string>
		logo: {
			src: string
			darkSrc?: string
			alt: string
			width: number
			height: number
			className?: string
		}
	}
> = {
	newsletter: {
		eyebrow: 'Main newsletter',
		description: 'Data-backed notes on DeFi markets, product releases, and new datasets from the DefiLlama team.',
		bestFor: 'For market watchers, builders, and data users.',
		bullets: ['Onchain market context', 'New tools and dataset releases', 'Practical ways to use DefiLlama data'],
		logo: {
			src: '/assets/defillama-newsletter-logo-light.png',
			darkSrc: '/assets/defillama-newsletter-logo-dark.png',
			alt: 'DefiLlama Newsletter logo',
			width: 760,
			height: 220,
			className: 'h-14 w-auto max-w-full object-contain sm:h-16'
		}
	},
	research: {
		eyebrow: 'Research publication',
		description: 'Reports, interviews, roundtables, and institutional market intelligence from DefiLlama Research.',
		bestFor: 'For analysts, teams, and institutional readers.',
		bullets: ['New research report releases', 'Interviews and roundtable drops', 'Strategic market analysis'],
		logo: {
			src: '/assets/research_logo.webp',
			darkSrc: '/assets/research_logo_dark.webp',
			alt: 'DefiLlama Research logo',
			width: 922,
			height: 293,
			className: 'h-12 w-auto max-w-full object-contain sm:h-14'
		}
	}
}

export default function NewslettersPage() {
	const { user } = useAuthContext()
	const publicationsErrorId = useId()
	const mutation = useNewsletterSubscription()

	const accountEmail =
		user?.email && isWalletEmail(user.email) ? ((user.ethereum_email as string | undefined) ?? '') : (user?.email ?? '')

	const [email, setEmail] = useState(accountEmail)
	const [prevAccountEmail, setPrevAccountEmail] = useState(accountEmail)
	const [touched, setTouched] = useState(false)
	const [submitted, setSubmitted] = useState(false)
	const [selected, setSelected] = useState<Record<NewsletterKey, boolean>>(initialSelected)
	const [succeeded, setSucceeded] = useState(false)

	if (accountEmail !== prevAccountEmail) {
		setPrevAccountEmail(accountEmail)
		if (!touched) setEmail(accountEmail)
	}

	const selectedKeys = NEWSLETTERS.map((n) => n.key).filter((key) => selected[key])
	const isPending = mutation.isPending
	const emailMessage = emailError(email)
	const publicationsMessage = selectedKeys.length === 0 ? 'Choose at least one publication.' : null
	const publicationsError = submitted ? publicationsMessage : null
	const buttonText =
		selectedKeys.length === 2
			? 'Subscribe to both newsletters'
			: selectedKeys.length === 1
				? 'Subscribe to 1 newsletter'
				: 'Subscribe'

	const toggle = (key: NewsletterKey) => {
		setSelected((current) => ({ ...current, [key]: !current[key] }))
		if (succeeded) setSucceeded(false)
	}

	const onEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
		setEmail(e.target.value)
		setTouched(true)
		if (succeeded) setSucceeded(false)
	}

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (isPending) return
		if (emailMessage || publicationsMessage) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		mutation.mutate(
			{ email: email.trim(), newsletters: selectedKeys },
			{
				onSuccess: (data) => {
					if (selectedKeys.every((key) => data.result?.[key] === 'ok')) {
						setSucceeded(true)
						setSubmitted(false)
					}
				}
			}
		)
	}

	return (
		<Layout
			title="DefiLlama Newsletters"
			description="Choose the DefiLlama newsletters you want to receive."
			canonicalUrl="/newsletters"
		>
			<main className="relative isolate min-h-[calc(100svh-160px)] overflow-hidden">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,color-mix(in_oklch,var(--text-link)_8%,transparent)_1px,transparent_1px),linear-gradient(180deg,color-mix(in_oklch,var(--text-link)_6%,transparent)_1px,transparent_1px)] opacity-25"
					style={{ backgroundSize: '72px 72px' }}
				/>
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
					<header className="flex flex-col gap-5 border-b border-medium pb-6">
						<div className="flex max-w-3xl flex-col gap-3">
							<p className="flex items-center gap-2 title-md text-link">
								<Icon name="mail-rounded" height={20} width={20} aria-hidden />
								DefiLlama newsletters
							</p>
							<h1 className="max-w-3xl text-[clamp(2.25rem,4.25vw,4.5rem)] leading-[0.96] font-bold tracking-tight text-primary">
								Subscribe for onchain fundamentals and analysis from DefiLlama
							</h1>
							<p className="max-w-2xl body-lg text-secondary">
								Market updates and Research Notes from the DefiLlama team, delivered to your inbox.
							</p>
						</div>
					</header>

					<form
						noValidate
						onSubmit={handleSubmit}
						className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,390px)] lg:items-start"
					>
						<section className="flex flex-col gap-4" aria-labelledby="newsletter-options-title">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<h2 id="newsletter-options-title" className="heading-sm text-primary">
										Pick your publications
									</h2>
									<p className="mt-2 max-w-2xl body-md text-secondary">
										Subscribe to either publication below, or select both.
									</p>
								</div>
								<p className="label-md text-link" aria-live="polite">
									{selectedKeys.length}/{NEWSLETTERS.length} selected
								</p>
							</div>

							<div
								className="grid gap-4 xl:grid-cols-2"
								role="group"
								aria-labelledby="newsletter-options-title"
								aria-describedby={publicationsError ? publicationsErrorId : undefined}
								data-invalid={publicationsError ? '' : undefined}
							>
								{NEWSLETTERS.map(({ key, label }) => {
									const on = selected[key]
									const details = newsletterDetails[key]
									return (
										<Ariakit.Button
											key={key}
											type="button"
											aria-pressed={on}
											onClick={() => toggle(key)}
											disabled={isPending}
											accessibleWhenDisabled
											className={`group relative flex w-full flex-col gap-4 overflow-hidden rounded-lg border p-5 text-left transition-[border-color,background-color,transform] duration-200 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${
												!isPending ? 'motion-safe:hover:-translate-y-0.5' : ''
											} ${on ? 'border-brand bg-brand-muted' : 'border-medium bg-surface hover:border-brand-strong'}`}
										>
											<span className="flex min-h-16 items-center justify-start">
												<img
													src={details.logo.src}
													alt={details.logo.alt}
													width={details.logo.width}
													height={details.logo.height}
													loading="lazy"
													decoding="async"
													className={`${details.logo.className ?? 'h-full w-auto max-w-full object-contain'} ${
														details.logo.darkSrc ? 'dark:hidden' : ''
													}`}
												/>
												{details.logo.darkSrc ? (
													<img
														src={details.logo.darkSrc}
														alt=""
														width={details.logo.width}
														height={details.logo.height}
														loading="lazy"
														decoding="async"
														className={`${details.logo.className ?? 'h-full w-auto max-w-full object-contain'} hidden dark:block`}
													/>
												) : null}
											</span>
											<span className="flex min-w-0 flex-col gap-3">
												<span className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
													<span className="flex min-w-0 flex-wrap items-center gap-3">
														<span className="title-sm tracking-[0.14em] text-link uppercase">{details.eyebrow}</span>
													</span>
													<span
														className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 label-sm whitespace-nowrap transition-colors ${
															on ? 'border-brand bg-brand text-on-brand' : 'border-medium text-secondary'
														}`}
														aria-hidden
													>
														{on ? <Icon name="check" height={13} width={13} /> : null}
														{on ? 'Selected' : 'Add'}
													</span>
												</span>
												<span>
													<span className="block text-xl leading-tight font-semibold text-primary">{label}</span>
													<span className="mt-2 block max-w-2xl body-md text-secondary">{details.description}</span>
												</span>
												<span className="block label-md text-primary">{details.bestFor}</span>
												<span className="grid gap-2">
													{details.bullets.map((bullet) => (
														<span key={bullet} className="flex gap-2 body-md text-secondary">
															<span className="mt-2 size-1 shrink-0 rounded-full bg-link" aria-hidden />
															{bullet}
														</span>
													))}
												</span>
											</span>
										</Ariakit.Button>
									)
								})}
							</div>
							{publicationsError ? (
								<p id={publicationsErrorId} className="body-sm text-error">
									{publicationsError}
								</p>
							) : null}
						</section>

						<aside className="lg:sticky lg:top-6">
							<div className="flex flex-col gap-5 rounded-lg border border-medium bg-surface p-5">
								<div className="flex flex-col gap-2">
									<h2 className="heading-sm text-primary">Subscribe</h2>
									<p className="body-md text-secondary">
										Enter the email address where you want to receive the selected newsletters.
									</p>
								</div>

								<Field label="Email address" error={submitted ? emailMessage : null}>
									{(control) => (
										<Input
											{...control}
											type="email"
											required
											value={email}
											onChange={onEmailChange}
											placeholder="you@example.com"
										/>
									)}
								</Field>

								<Button type="submit" variant="primary" size="lg" pendingLabel={isPending ? 'Subscribing…' : null}>
									{buttonText}
								</Button>

								<div className="min-h-14">
									{succeeded ? (
										<div role="status" className="flex items-start gap-2 body-md text-primary">
											<Icon name="check-circle" height={18} width={18} className="mt-1 shrink-0 text-link" />
											<span>Subscribed. You are on the selected newsletter list.</span>
										</div>
									) : null}
								</div>
							</div>
						</aside>
					</form>
				</div>
			</main>
		</Layout>
	)
}
