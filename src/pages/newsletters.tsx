import { type ChangeEvent, type FormEvent, useId, useState } from 'react'
import { Icon } from '~/components/Icon'
import { isWalletEmail } from '~/containers/Account/utils'
import { useAuthContext } from '~/containers/Subscription/auth'
import { NEWSLETTERS, type NewsletterKey, useNewsletterSubscription } from '~/hooks/useNewsletterSubscription'
import Layout from '~/layout'

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
		comingSoon?: boolean
		bullets: string[]
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
		comingSoon: true,
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
	const helperId = useId()
	const mutation = useNewsletterSubscription()

	const accountEmail =
		user?.email && isWalletEmail(user.email) ? ((user.ethereum_email as string | undefined) ?? '') : (user?.email ?? '')

	const [email, setEmail] = useState(accountEmail)
	const [prevAccountEmail, setPrevAccountEmail] = useState(accountEmail)
	const [touched, setTouched] = useState(false)
	const [selected, setSelected] = useState<Record<NewsletterKey, boolean>>(initialSelected)
	const [succeeded, setSucceeded] = useState(false)

	if (accountEmail !== prevAccountEmail) {
		setPrevAccountEmail(accountEmail)
		if (!touched) setEmail(accountEmail)
	}

	const selectedKeys = NEWSLETTERS.map((n) => n.key).filter((key) => selected[key])
	const selectedLabels = NEWSLETTERS.filter((n) => selected[n.key]).map((n) => n.label)
	const noneSelected = selectedKeys.length === 0
	const isPending = mutation.isPending
	const canSubmit = !isPending && !noneSelected && email.trim().length > 0
	const helperText = noneSelected
		? 'Choose at least one newsletter.'
		: `${selectedKeys.length} publication${selectedKeys.length === 1 ? '' : 's'} selected.`
	const visibleSelectionText = `${selectedKeys.length}/${NEWSLETTERS.length} selected`
	const selectedSummary = noneSelected ? 'No newsletters selected yet' : selectedLabels.join(' + ')
	const buttonText = noneSelected
		? 'Choose a newsletter'
		: email.trim().length === 0
			? 'Enter email'
			: selectedKeys.length === 1
				? 'Subscribe to 1 newsletter'
				: 'Subscribe to both newsletters'

	const toggle = (key: NewsletterKey) => {
		setSelected((current) => ({ ...current, [key]: !current[key] }))
		if (succeeded) setSucceeded(false)
	}

	const onEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
		setEmail(e.target.value)
		setTouched(true)
		if (succeeded) setSucceeded(false)
	}

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		if (!canSubmit) return
		const submittedKeys = selectedKeys
		mutation.mutate(
			{ email: email.trim(), newsletters: submittedKeys },
			{
				onSuccess: (data) => {
					if (submittedKeys.every((key) => data.result?.[key] === 'ok')) {
						setSucceeded(true)
					}
				}
			}
		)
	}

	const spinner = <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />

	return (
		<Layout
			title="DefiLlama Newsletters"
			description="Choose the DefiLlama newsletters you want to receive."
			canonicalUrl="/newsletters"
		>
			<main className="relative isolate min-h-[calc(100svh-160px)] overflow-hidden">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,color-mix(in_oklch,var(--link-text)_8%,transparent)_1px,transparent_1px),linear-gradient(180deg,color-mix(in_oklch,var(--link-text)_6%,transparent)_1px,transparent_1px)] opacity-25"
					style={{ backgroundSize: '72px 72px' }}
				/>
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
					<header className="grid gap-5 border-b border-(--cards-border) pb-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(260px,0.35fr)] lg:items-end">
						<div className="flex max-w-3xl flex-col gap-3">
							<p className="flex items-center gap-2 text-sm font-semibold text-(--link-text)">
								<Icon name="mail-rounded" height={20} width={20} aria-hidden />
								DefiLlama newsletters
							</p>
							<h1 className="max-w-3xl text-[clamp(2.25rem,4.25vw,4.5rem)] leading-[0.96] font-bold tracking-tight text-(--text-primary)">
								Choose your DefiLlama newsletters
							</h1>
							<p className="max-w-2xl text-base leading-7 text-(--text-secondary)">
								Market updates from the DefiLlama team are live now. You can also join the research list before it
								starts sending.
							</p>
						</div>

						<div className="flex flex-col gap-2 border-t border-(--cards-border) pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
							<p className="text-xs font-semibold tracking-[0.18em] text-(--link-text) uppercase">
								Available newsletters
							</p>
							<p className="text-xl leading-tight font-semibold text-(--text-primary)">
								Market updates live, research soon
							</p>
							<p className="text-sm leading-6 text-(--text-secondary)">
								Pick the lists you want to receive at this email.
							</p>
						</div>
					</header>

					<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,390px)] lg:items-start">
						<section className="flex flex-col gap-4" aria-labelledby="newsletter-options-title">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<h2 id="newsletter-options-title" className="heading-sm text-(--text-primary)">
										Pick your publications
									</h2>
									<p className="mt-2 max-w-2xl text-sm leading-6 text-(--text-secondary)">
										Subscribe to either publication below. Research is marked as coming soon, but the list is open.
									</p>
								</div>
								<p className="text-sm font-medium text-(--link-text)" aria-live="polite">
									{visibleSelectionText}
								</p>
							</div>

							<div
								className="grid gap-4 xl:grid-cols-2"
								role="group"
								aria-describedby={helperId}
								aria-label="Newsletters"
							>
								{NEWSLETTERS.map(({ key, label }) => {
									const on = selected[key]
									const details = newsletterDetails[key]
									const isComingSoon = details.comingSoon === true
									return (
										<button
											key={key}
											type="button"
											aria-pressed={on}
											onClick={() => toggle(key)}
											disabled={isPending}
											className={`group relative flex w-full flex-col gap-4 overflow-hidden rounded-lg border p-5 text-left transition-[border-color,background-color,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
												!isPending ? 'motion-safe:hover:-translate-y-0.5' : ''
											} ${
												on
													? 'border-(--link-text) bg-(--link-button)'
													: 'border-(--cards-border) bg-(--cards-bg) hover:border-(--link-text)/50'
											}`}
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
														<span className="text-xs font-semibold tracking-[0.14em] text-(--link-text) uppercase">
															{details.eyebrow}
														</span>
														{isComingSoon ? (
															<span className="inline-flex h-7 items-center rounded-full border border-(--cards-border) bg-(--bg-main) px-2.5 text-[11px] font-semibold whitespace-nowrap text-(--text-secondary)">
																Coming soon
															</span>
														) : null}
													</span>
													<span
														className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
															on
																? 'border-(--link-text) bg-(--link-text) text-white'
																: 'border-(--cards-border) text-(--text-secondary)'
														}`}
														aria-hidden
													>
														{on ? <Icon name="check" height={13} width={13} /> : null}
														{on ? 'Selected' : 'Add'}
													</span>
												</span>
												<span>
													<span className="block text-xl leading-tight font-semibold text-(--text-primary)">
														{label}
													</span>
													<span className="mt-2 block max-w-2xl text-sm leading-6 text-(--text-secondary)">
														{details.description}
													</span>
												</span>
												<span className="block text-sm font-medium text-(--text-primary)">{details.bestFor}</span>
												<span className="grid gap-2">
													{details.bullets.map((bullet) => (
														<span key={bullet} className="flex gap-2 text-sm leading-5 text-(--text-secondary)">
															<span className="mt-2 size-1 shrink-0 rounded-full bg-(--link-text)" aria-hidden />
															{bullet}
														</span>
													))}
												</span>
											</span>
										</button>
									)
								})}
							</div>
							<p id={helperId} className="sr-only" aria-live="polite">
								{helperText}
							</p>
						</section>

						<aside className="lg:sticky lg:top-6">
							<form
								onSubmit={handleSubmit}
								className="flex flex-col gap-5 rounded-lg border border-(--cards-border) bg-(--cards-bg) p-5"
							>
								<div className="flex flex-col gap-2">
									<p className="text-xs font-semibold tracking-[0.18em] text-(--link-text) uppercase">Subscribe</p>
									<h2 className="heading-sm text-(--text-primary)">Send them here</h2>
									<p className="text-sm leading-6 text-(--text-secondary)">
										Enter the email address where you want to receive the selected newsletters.
									</p>
								</div>

								<div className="border-y border-(--cards-border) py-4">
									<p className="text-xs font-semibold tracking-[0.14em] text-(--text-tertiary) uppercase">
										Selected publications
									</p>
									<p className="mt-2 text-base leading-6 font-medium text-(--text-primary)">{selectedSummary}</p>
								</div>

								<label className="flex flex-col gap-2">
									<span className="text-sm font-medium text-(--text-primary)">Email address</span>
									<input
										type="email"
										required
										value={email}
										onChange={onEmailChange}
										placeholder="you@example.com"
										className="h-12 rounded-lg border border-(--cards-border) bg-(--bg-main) px-3 text-sm text-(--text-primary) transition-colors outline-none placeholder:text-(--text-tertiary) focus-visible:border-(--link-text)"
									/>
								</label>

								<button
									type="submit"
									aria-busy={isPending}
									aria-describedby={helperId}
									disabled={!canSubmit}
									className="flex h-12 items-center justify-center gap-2 rounded-lg bg-(--link-text) px-5 text-sm font-semibold text-white transition-[opacity,transform] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[0.98]"
								>
									{isPending ? (
										<>
											{spinner}
											Subscribing...
										</>
									) : (
										buttonText
									)}
								</button>

								<div className="min-h-14">
									{succeeded ? (
										<div role="status" className="flex items-start gap-2 text-sm leading-6 text-(--text-primary)">
											<Icon name="check-circle" height={18} width={18} className="mt-1 shrink-0 text-(--link-text)" />
											<span>Subscribed. You are on the selected newsletter list.</span>
										</div>
									) : (
										<p className="text-sm leading-6 text-(--text-secondary)">
											{noneSelected
												? 'Choose at least one publication to continue.'
												: `We will subscribe this email to ${selectedSummary}.`}
										</p>
									)}
								</div>
							</form>
						</aside>
					</div>
				</div>
			</main>
		</Layout>
	)
}
