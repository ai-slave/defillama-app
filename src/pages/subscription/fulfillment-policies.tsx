import Head from 'next/head'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { LinkPreviewCard, SEO } from '~/components/SEO'

export default function FulfillmentPolicies() {
	return (
		<SubscribeLayout2
			title="Subscribe - Fulfillment Policies - DefiLlama"
			description="DefiLlama subscription refund and cancellation policies."
			canonicalUrl="/subscription/fulfillment-policies"
		>
			<div className="mx-auto mb-16 flex w-full max-w-xl flex-col gap-8 text-secondary">
				<h1 className="text-center heading-lg text-primary">Fulfillment Policies</h1>

				<div className="flex flex-col gap-3">
					<h2 className="heading-sm text-primary">Refund Policy</h2>
					<p>
						If you haven't made any request to the API yet and all your credits are unused, please send an email to{' '}
						<a href="mailto:support@defillama.com" className="underline">
							support@defillama.com
						</a>{' '}
						and we'll refund your payment. In case you've already made any API request, no refunds will be given, but
						you can still cancel your subscription.
					</p>
				</div>

				<div className="flex flex-col gap-3">
					<h2 className="heading-sm text-primary">Cancellation Policy</h2>
					<p>You can cancel your subscription at any time.</p>
				</div>
			</div>
		</SubscribeLayout2>
	)
}

export function SubscribeLayout2({
	children,
	title = 'Subscribe - DefiLlama',
	description,
	canonicalUrl
}: {
	children: React.ReactNode
	title?: string
	description?: string
	canonicalUrl?: string | null
}) {
	return (
		<>
			<SEO title={title} description={description} canonicalUrl={canonicalUrl} />
			<Head>
				<link rel="icon" type="image/png" href="/favicon-32x32.png" />
			</Head>
			<LinkPreviewCard />
			<div className="theme-dark col-span-full flex min-h-screen w-full flex-col bg-page text-primary">
				<header className="sticky top-0 z-50 border-b border-subtle bg-page-glass backdrop-blur-md">
					<div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 xl:max-w-7xl 2xl:max-w-[1440px]">
						<BasicLink href="/" className="flex items-center gap-3">
							<img src="/assets/llama.webp" alt="DefiLlama" width={32} height={32} className="rounded-full" />
							<span className="hidden heading-xs sm:inline-block">DefiLlama</span>
						</BasicLink>
						<div className="flex items-center gap-4">
							<BasicLink href="/" className="label-md text-secondary transition-colors hover:text-primary">
								Return to main page
							</BasicLink>
						</div>
					</div>
				</header>

				<main className="grow">
					<header className="flex min-h-[64px] items-center justify-end gap-4 px-5 py-3" />
					{children}
				</main>

				<footer className="mt-auto flex flex-wrap items-center justify-center gap-4 px-5 py-3 text-secondary">
					<a href="https://discord.defillama.com" className="underline">
						Discord
					</a>
					<a href="mailto:support@defillama.com" className="underline">
						Contact Us
					</a>

					<BasicLink href="/privacy-policy" className="underline">
						Privacy Policy
					</BasicLink>

					<BasicLink href="/subscription/fulfillment-policies" className="underline">
						Fulfillment policies
					</BasicLink>

					<BasicLink href="/terms" className="underline">
						Terms of Service
					</BasicLink>
				</footer>
			</div>
		</>
	)
}
