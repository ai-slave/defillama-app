import * as Ariakit from '@ariakit/react'
import Link from 'next/link'
import { type ChangeEvent, type FormEvent, useId, useState } from 'react'
import { ResearchIcon } from '~/components/ResearchIcon'
import { useMediaKitEmail } from '~/hooks/useNewsletterSubscription'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { emailError } from '~/utils/email'

const BRAND_KIT_URL = 'https://defillama.com/defillama-press-kit.zip'
const NEWSLETTER_URL = '/newsletters'

type FooterLink = { label: string; href: string; external?: boolean }
type FooterColumnDef = { title: string; links: Array<FooterLink> }

const SECTION_LINKS: Array<FooterLink> = [
	{ label: 'Reports', href: '/research/report' },
	{ label: 'Spotlights', href: '/research/spotlight' },
	{ label: 'Interviews', href: '/research/interview' },
	{ label: 'Opinion', href: '/research/opinion' },
	{ label: 'Roundtables', href: '/research/roundtables' }
]

const ABOUT_LINKS: Array<FooterLink> = [
	{ label: 'Who we are', href: '/research/authors/defillama-research' },
	{ label: 'Contact us', href: 'mailto:research@defillama.com', external: true },
	{ label: 'Book a call', href: 'https://calendly.com/research-defillama/30min', external: true },
	{ label: 'Brand kit', href: BRAND_KIT_URL, external: true },
	{ label: 'Trusted by', href: '/research#clients' }
]

// Add a new column here (or push to the arrays above) and it renders in both the
// desktop grid and the mobile accordion automatically.
const FOOTER_COLUMNS: Array<FooterColumnDef> = [
	{ title: 'Sections', links: SECTION_LINKS },
	{ title: 'About us', links: ABOUT_LINKS }
]

const SOCIAL_LINKS = [
	{ name: 'x-social' as const, label: 'Follow DefiLlama Research on X', href: 'https://x.com/defillama_res' },
	{ name: 'telegram' as const, label: 'Join DefiLlama Research on Telegram', href: 'https://t.me/defillama_research' },
	{
		name: 'linkedin' as const,
		label: 'Follow DefiLlama on LinkedIn',
		href: 'https://www.linkedin.com/company/defillama/'
	},
	{ name: 'rss-feed' as const, label: 'Subscribe via RSS', href: '/research/feed' }
]

const LEGAL_LINKS: Array<FooterLink> = [
	{ label: 'Terms of Service', href: '/terms' },
	{ label: 'Privacy Policy', href: '/privacy-policy' },
	{ label: 'Sitemap', href: '/research/sitemap.xml', external: true }
]

const headingClassName = 'title-sm uppercase tracking-widest text-primary'
const linkClassName = 'label-md text-primary transition-colors hover:text-secondary'
const descriptionClassName = 'body-md text-secondary'
const legalLinkClassName = 'body-sm text-secondary transition-colors hover:text-primary'

function FooterLinkItem({ link }: { link: FooterLink }) {
	if (link.external) {
		return (
			<a
				href={link.href}
				target={link.href.startsWith('mailto:') ? undefined : '_blank'}
				rel={link.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
				className={linkClassName}
			>
				{link.label}
			</a>
		)
	}
	return (
		<Link href={link.href} className={linkClassName}>
			{link.label}
		</Link>
	)
}

function FooterSocials() {
	const itemClassName = 'flex text-primary transition-colors hover:text-secondary'
	return (
		<ul className="flex items-center gap-3">
			{SOCIAL_LINKS.map((social) => (
				<li key={social.name}>
					{social.href.startsWith('/') ? (
						<Link href={social.href} aria-label={social.label} className={itemClassName}>
							<ResearchIcon name={social.name} width={30} height={30} aria-hidden />
						</Link>
					) : (
						<a
							href={social.href}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={social.label}
							className={itemClassName}
						>
							<ResearchIcon name={social.name} width={30} height={30} aria-hidden />
						</a>
					)}
				</li>
			))}
		</ul>
	)
}

function FooterBrand({ className = '', wideDescription = false }: { className?: string; wideDescription?: boolean }) {
	return (
		<div className={`flex flex-col gap-5 ${className}`}>
			<Link
				href="/research"
				aria-label="DefiLlama Research home"
				className="inline-flex w-fit transition-opacity hover:opacity-80"
			>
				<img
					src="/assets/research_logo.webp"
					alt="DefiLlama Research"
					width={229}
					height={72}
					className="h-10 w-auto dark:hidden"
				/>
				<img
					src="/assets/research_logo_dark.webp"
					alt="DefiLlama Research"
					width={229}
					height={72}
					className="hidden h-10 w-auto dark:block"
				/>
			</Link>
			<p className={`${descriptionClassName} ${wideDescription ? '' : 'max-w-xs'}`}>
				Bespoke digital asset research, market intelligence, and strategic advisory services powered by the DefiLlama
				ecosystem.
			</p>
			<FooterSocials />
		</div>
	)
}

function FooterColumn({ title, links }: FooterColumnDef) {
	return (
		<nav aria-label={title} className="flex flex-col gap-4">
			<h2 className={headingClassName}>{title}</h2>
			<ul className="flex flex-col gap-2.5">
				{links.map((link) => (
					<li key={link.label}>
						<FooterLinkItem link={link} />
					</li>
				))}
			</ul>
		</nav>
	)
}

function FooterAccordion({ title, links }: FooterColumnDef) {
	const [open, setOpen] = useState(false)
	const panelId = useId()
	return (
		<div className="border-b border-medium">
			<h2>
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
					aria-controls={panelId}
					className="flex w-full items-center justify-between gap-2 py-4 text-left"
				>
					<span className={headingClassName}>{title}</span>
					<Icon
						name="chevron-down"
						height={18}
						width={18}
						className={`shrink-0 text-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
					/>
				</button>
			</h2>
			<div
				id={panelId}
				className={`overflow-hidden transition-all duration-300 ease-out ${open ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}
			>
				<ul className="flex flex-col gap-3 pb-5">
					{links.map((link) => (
						<li key={link.label}>
							<FooterLinkItem link={link} />
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}

function FooterMediaKit() {
	const mutation = useMediaKitEmail()
	const errorId = useId()
	const [email, setEmail] = useState('')
	const [submitted, setSubmitted] = useState(false)
	const [isSent, setIsSent] = useState(false)

	const isPending = mutation.isPending
	const emailMessage = emailError(email)
	const error = submitted ? emailMessage : null

	const onEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
		setEmail(e.target.value)
		if (isSent) setIsSent(false)
	}

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (isPending || isSent) return
		if (emailMessage) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		const trimmedEmail = email.trim()
		mutation.mutate(
			{ email: trimmedEmail },
			{
				onSuccess: () => {
					trackUmamiEvent('research-media-kit-email-sent')
					setIsSent(true)
					setSubmitted(false)
				}
			}
		)
	}

	return (
		<div id="research-media-kit" className="flex scroll-mt-6 flex-col gap-4">
			<h2 className={headingClassName}>Get our media kit</h2>
			<p className={`max-w-sm ${descriptionClassName}`}>
				Explore our product overviews, package details, key differentiators, and essential information.
			</p>
			{/* The underline input carries its label as a placeholder, so Field's visible label would not fit; the error is
			    wired by hand the same way (data-invalid for showFieldErrors, aria-invalid and aria-describedby). */}
			<form noValidate onSubmit={handleSubmit} className="flex flex-col gap-2">
				<div data-invalid={error ? '' : undefined} className="flex flex-col gap-3 sm:flex-row sm:items-end">
					<input
						type="email"
						required
						aria-label="Email address"
						aria-invalid={error ? true : undefined}
						aria-describedby={error ? errorId : undefined}
						value={email}
						onChange={onEmailChange}
						placeholder="Email address"
						className="min-w-0 flex-1 appearance-none border-x-0 border-t-0 border-b border-medium bg-transparent pb-2 body-md text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden aria-invalid:border-error aria-invalid:focus:border-error"
					/>
					{/* Sending leaves nothing to submit until the email changes, so the pressed button disables itself. */}
					<Ariakit.Button
						type="submit"
						aria-busy={isPending}
						disabled={isPending || isSent}
						accessibleWhenDisabled
						className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-6 label-md text-on-brand not-aria-disabled:hover:brightness-110 focus-visible:focus-ring-on-brand aria-disabled:not-aria-busy:bg-disabled aria-disabled:not-aria-busy:text-disabled ${
							isPending ? 'aria-disabled:cursor-wait' : 'aria-disabled:cursor-not-allowed'
						}`}
					>
						{isPending ? (
							<>
								<LoadingSpinner size={16} />
								<span className="sr-only">Sending…</span>
							</>
						) : isSent ? (
							'Sent'
						) : (
							'Get the media kit'
						)}
					</Ariakit.Button>
				</div>
				{error ? (
					<p id={errorId} className="body-sm text-error">
						{error}
					</p>
				) : null}
			</form>
			{isSent ? (
				<p role="status" className={descriptionClassName}>
					Check your inbox for the media kit link.
				</p>
			) : null}
			<Link
				href={NEWSLETTER_URL}
				className={`${headingClassName} group mt-1 inline-flex w-fit items-center gap-1.5 transition-colors hover:text-secondary`}
			>
				DefiLlama newsletters
				<Icon
					name="arrow-right"
					height={14}
					width={14}
					className="transition-transform duration-200 group-hover:translate-x-0.5"
				/>
			</Link>
		</div>
	)
}

function FooterLegalBar() {
	return (
		<div className="mt-10 flex flex-col items-center gap-4 border-t border-medium pt-6 text-center sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:text-left">
			<p className="body-sm text-tertiary">© DefiLlama Research. All rights reserved.</p>
			<ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-start">
				{LEGAL_LINKS.map((link) => (
					<li key={link.label}>
						{link.external ? (
							<a href={link.href} className={legalLinkClassName}>
								{link.label}
							</a>
						) : (
							<Link href={link.href} className={legalLinkClassName}>
								{link.label}
							</Link>
						)}
					</li>
				))}
			</ul>
		</div>
	)
}

export function ResearchFooter({ maxWidthClassName = 'max-w-7xl' }: { maxWidthClassName?: string }) {
	return (
		<footer className="text-primary">
			<div className={`mx-auto w-full ${maxWidthClassName} px-4 sm:px-6 lg:px-6`}>
				<div className="border-t border-medium py-8">
					<div className="hidden gap-x-10 gap-y-12 md:flex md:flex-wrap md:justify-between">
						<FooterBrand />
						{FOOTER_COLUMNS.map((col) => (
							<FooterColumn key={col.title} title={col.title} links={col.links} />
						))}
						<div className="w-full lg:w-auto lg:max-w-sm">
							<FooterMediaKit />
						</div>
					</div>

					<div className="flex flex-col md:hidden">
						<FooterMediaKit />
						<nav aria-label="Footer links" className="mt-8 border-t border-medium">
							{FOOTER_COLUMNS.map((col) => (
								<FooterAccordion key={col.title} title={col.title} links={col.links} />
							))}
						</nav>
						<FooterBrand className="mt-6" wideDescription />
					</div>

					<FooterLegalBar />
				</div>
			</div>
		</footer>
	)
}
