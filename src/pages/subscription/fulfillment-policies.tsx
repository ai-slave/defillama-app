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
			<div className="mx-auto mb-16 flex w-full max-w-xl flex-col gap-8 text-[#d5d5d5]">
				<h1 className="text-center text-3xl font-bold text-on-brand">Fulfillment Policies</h1>

				<div className="flex flex-col gap-3">
					<h2 className="text-xl font-semibold text-on-brand">Refund Policy</h2>
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
					<h2 className="text-xl font-semibold text-on-brand">Cancellation Policy</h2>
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
			<div className="col-span-full flex min-h-screen w-full flex-col bg-[oklch(0.148_0.004_228.8)] text-on-brand">
				<header className="sticky top-0 z-50 border-b border-sub-line/40 bg-sub-dark-panel/80 backdrop-blur-md">
					<div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 xl:max-w-7xl 2xl:max-w-[1440px]">
						<BasicLink href="/" className="flex items-center gap-3">
							<img src="/assets/llama.webp" alt="DefiLlama" width={32} height={32} className="rounded-full" />
							<span className="hidden text-lg font-bold sm:inline-block">DefiLlama</span>
						</BasicLink>
						<div className="flex items-center gap-4">
							<BasicLink
								href="/"
								className="text-sm font-medium text-sub-text-soft transition-colors hover:text-on-brand"
							>
								Return to Main Page
							</BasicLink>
						</div>
					</div>
				</header>

				<main className="grow">
					<header className="flex min-h-[64px] items-center justify-end gap-4 px-5 py-3" />
					{children}
				</main>

				<footer className="mt-auto flex flex-wrap items-center justify-center gap-4 px-5 py-3 text-sub-text-muted">
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
