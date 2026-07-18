import * as Ariakit from '@ariakit/react'
import Head from 'next/head'
import * as React from 'react'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { LinkPreviewCard, SEO } from '~/components/SEO'
import { Toast } from '~/components/Toast'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { Icon } from '~/ui/Icon'

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
			<div className="col-span-full flex min-h-screen w-full flex-col bg-sub-dark-panel text-on-brand">
				<header className="sticky top-0 z-50 h-12 bg-transparent">
					<div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 xl:max-w-7xl 2xl:max-w-[1440px]">
						<div className="flex items-center gap-3">
							<BasicLink
								href="/"
								className="flex items-center gap-2 text-sub-text-soft transition-colors hover:text-on-brand"
							>
								<Icon name="chevron-left" height={20} width={20} />
								<span className="hidden sm:inline-block">Back</span>
							</BasicLink>
						</div>

						<div className="flex items-center gap-2">
							{!isAuthenticated ? (
								<SignInModal
									className="rounded-lg bg-sub-purple px-3 py-1.5 text-sm font-medium text-on-brand transition-all duration-200 hover:bg-sub-purple-hover"
									hideWhenAuthenticated={false}
								/>
							) : (
								<Ariakit.MenuProvider open={isMenuOpen} setOpen={setIsMenuOpen}>
									<Ariakit.MenuButton className="flex size-8 items-center justify-center rounded-lg text-sub-text-soft transition-colors hover:bg-sub-dark-card-raised hover:text-on-brand">
										<Icon name="menu" height={18} width={18} />
									</Ariakit.MenuButton>
									<Ariakit.Menu
										className="z-50 min-w-[180px] rounded-lg border border-sub-line bg-sub-dark-panel py-2 shadow-xl backdrop-blur-md"
										gutter={8}
									>
										<Ariakit.MenuItem
											className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-on-brand transition-colors hover:bg-sub-dark-card-raised focus:bg-sub-dark-card-raised focus:outline-hidden"
											render={<BasicLink href="/" />}
										>
											<Icon name="arrow-left" height={14} width={14} className="text-sub-text-muted" />
											Return to Main Page
										</Ariakit.MenuItem>
										<div className="my-1 h-px bg-sub-line" />
										<Ariakit.MenuItem
											className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-on-brand transition-colors hover:bg-sub-dark-card-raised focus:bg-sub-dark-card-raised focus:outline-hidden"
											onClick={logout}
										>
											<Icon name="x" height={14} width={14} className="text-error" />
											Logout
										</Ariakit.MenuItem>
									</Ariakit.Menu>
								</Ariakit.MenuProvider>
							)}
						</div>
					</div>
				</header>

				<main className="grid grow py-8">{children}</main>

				<footer className="mt-auto border-t border-sub-line/40 px-5 py-8">
					<div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px]">
						<div className="flex flex-col items-center justify-between gap-6 md:flex-row">
							<div className="flex items-center gap-3">
								<img src="/assets/llama.webp" alt="DefiLlama" width={28} height={28} className="rounded-full" />
								<span className="font-bold">DefiLlama</span>
							</div>

							<div className="flex flex-wrap items-center justify-center gap-6 text-sub-text-muted">
								<a href="https://discord.defillama.com" className="transition-colors hover:text-on-brand">
									Discord
								</a>
								<a href="https://x.com/DefiLlama" className="transition-colors hover:text-on-brand">
									Twitter
								</a>
								<a href="https://github.com/DefiLlama" className="transition-colors hover:text-on-brand">
									GitHub
								</a>
								<a href="mailto:support@defillama.com" className="transition-colors hover:text-on-brand">
									Contact Us
								</a>
							</div>
						</div>

						<div className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-sub-line/40 pt-6 text-xs text-sub-text-muted md:justify-between">
							<div>© {new Date().getFullYear()} DefiLlama. All rights reserved.</div>
							<div className="flex flex-wrap items-center gap-4">
								<BasicLink href="/privacy-policy" className="transition-colors hover:text-on-brand">
									Privacy Policy
								</BasicLink>

								<BasicLink href="/subscription/fulfillment-policies" className="transition-colors hover:text-on-brand">
									Fulfillment Policies
								</BasicLink>

								<BasicLink href="/terms" className="transition-colors hover:text-on-brand">
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
