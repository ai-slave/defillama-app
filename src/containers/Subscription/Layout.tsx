import * as Ariakit from '@ariakit/react'
import Head from 'next/head'
import * as React from 'react'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { LinkPreviewCard, SEO } from '~/components/SEO'
import { Toast } from '~/components/Toast'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSeparator, MenuSurface } from '~/ui/PopoverSurface'
import { StaleText } from '~/ui/StaleText'
import { Tooltip } from '~/ui/Tooltip'
import { COPYRIGHT_YEAR } from '~/utils/copyrightYear'

export function SubscribeLayout({
	children,
	title = 'Subscribe to DefiLlama Pro Analytics - DefiLlama',
	description,
	canonicalUrl
}: {
	children: React.ReactNode
	title?: string
	description?: string
	canonicalUrl?: string | null
}) {
	const { isAuthenticated, logout } = useAuthContext()
	const [isMenuOpen, setIsMenuOpen] = useState(false)

	return (
		<>
			<SEO title={title} description={description} canonicalUrl={canonicalUrl} />
			<Head>
				<link rel="icon" type="image/png" href="/favicon-32x32.png" />
			</Head>
			<LinkPreviewCard />
			<div className="theme-dark col-span-full flex min-h-screen w-full flex-col bg-page text-primary">
				<header className="sticky top-0 z-50 h-12 bg-transparent">
					<div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 xl:max-w-7xl 2xl:max-w-[1440px]">
						<div className="flex items-center gap-3">
							<BasicLink
								href="/"
								className="flex items-center gap-2 text-secondary transition-colors hover:text-primary"
							>
								<Icon name="chevron-left" className="size-5" />
								<span className="hidden sm:inline-block">Back</span>
							</BasicLink>
						</div>

						<div className="flex items-center gap-2">
							{/* No sign-in here: signed out, the page's own "Sign in to continue" step is the one call to action. */}
							{isAuthenticated ? (
								<Ariakit.MenuProvider open={isMenuOpen} setOpen={setIsMenuOpen}>
									<Tooltip
										// In place: a portal would render it outside this page\'s theme-dark scope.
										portal={false}
										content="Account menu"
										render={
											<Ariakit.MenuButton
												aria-label="Account menu"
												render={<Button variant="ghost" size="md" square />}
											/>
										}
									>
										<Icon name="menu" className="size-4" aria-hidden="true" />
									</Tooltip>
									{/* Portaled like every menu (an in-place drawer would be positioned inside a blurred or sticky header), so it
									    carries this page's always-dark scope itself. */}
									<MenuSurface variant="actions" className="theme-dark" aria-label="Account menu">
										<MenuItem render={<BasicLink href="/" />}>
											<Icon name="arrow-left" className="size-3.5 text-tertiary" aria-hidden="true" />
											Return to main page
										</MenuItem>
										<MenuSeparator />
										<MenuItem onClick={logout}>
											<Icon name="x" className="size-3.5 text-tertiary" aria-hidden="true" />
											Sign out
										</MenuItem>
									</MenuSurface>
								</Ariakit.MenuProvider>
							) : null}
						</div>
					</div>
				</header>

				<main className="grid grow py-8">{children}</main>

				<footer className="mt-auto border-t border-subtle px-5 py-8">
					<div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px]">
						<div className="flex flex-col items-center justify-between gap-6 md:flex-row">
							<div className="flex items-center gap-3">
								<img src="/assets/llama.webp" alt="DefiLlama" width={28} height={28} className="rounded-full" />
								<span className="font-bold">DefiLlama</span>
							</div>

							<div className="flex flex-wrap items-center justify-center gap-6 text-secondary">
								<a href="https://discord.defillama.com" className="transition-colors hover:text-primary">
									Discord
								</a>
								<a href="https://x.com/DefiLlama" className="transition-colors hover:text-primary">
									X/Twitter
								</a>
								<a href="https://github.com/DefiLlama" className="transition-colors hover:text-primary">
									GitHub
								</a>
								<a href="mailto:support@defillama.com" className="transition-colors hover:text-primary">
									Contact Us
								</a>
							</div>
						</div>

						<div className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-subtle pt-6 body-sm text-tertiary md:justify-between">
							<StaleText as="div">{`© ${COPYRIGHT_YEAR} DefiLlama. All rights reserved.`}</StaleText>
							<div className="flex flex-wrap items-center gap-4">
								<BasicLink href="/privacy-policy" className="text-secondary transition-colors hover:text-primary">
									Privacy Policy
								</BasicLink>

								<BasicLink
									href="/subscription/fulfillment-policies"
									className="text-secondary transition-colors hover:text-primary"
								>
									Fulfillment Policies
								</BasicLink>

								<BasicLink href="/terms" className="text-secondary transition-colors hover:text-primary">
									Terms of Service
								</BasicLink>
							</div>
						</div>
					</div>
				</footer>
				<Toast />
			</div>
		</>
	)
}
