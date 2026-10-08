import * as Ariakit from '@ariakit/react'
import Head from 'next/head'
import { BasicLink } from '~/components/Link'
import { LinkPreviewCard, SEO } from '~/components/SEO'
import SheetsContainer from '~/containers/Sheets'
import { Icon } from '~/ui/Icon'
import { StaleText } from '~/ui/StaleText'
import { COPYRIGHT_YEAR } from '~/utils/copyrightYear'

export default function Sheets() {
	return (
		<>
			<SEO
				title="DefiLlama Sheets - DeFi Data in Google Sheets"
				description="Access DeFi data directly in Google Sheets. Pull TVL, fees, revenue, and token data with DefiLlama's Sheets integration."
				canonicalUrl="/sheets"
			/>
			<Head>
				<link rel="icon" type="image/png" href="/favicon-32x32.png" />
			</Head>
			<LinkPreviewCard />
			<div className="theme-dark col-span-full flex min-h-screen w-full flex-col bg-page text-primary">
				<header className="sticky top-0 z-50 border-b border-subtle bg-page-glass backdrop-blur-md">
					<div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6 md:px-8">
						<BasicLink href="/" className="flex items-center gap-2.5">
							<img src="/assets/llama.webp" alt="DefiLlama" width={32} height={32} className="rounded-full" />
							<span className="title-md tracking-[-0.02em]">DefiLlama</span>
						</BasicLink>

						<nav aria-label="Sheets navigation" className="hidden items-center gap-1.5 sm:flex">
							<BasicLink
								href="https://docs.llama.fi/spreadsheet-functions/function-reference"
								data-umami-event="sheets-functions-reference-click"
								className="rounded-lg px-3.5 py-1.5 label-md text-secondary transition-colors hover:bg-hover-row hover:text-primary"
							>
								Functions Reference
							</BasicLink>
							<BasicLink
								href="https://docs.llama.fi/spreadsheet-functions/templates"
								data-umami-event="sheets-templates-click-header"
								className="rounded-lg px-3.5 py-1.5 label-md text-secondary transition-colors hover:bg-hover-row hover:text-primary"
							>
								Templates
							</BasicLink>
							<BasicLink
								href="/"
								className="rounded-lg px-3.5 py-1.5 label-md text-secondary transition-colors hover:bg-hover-row hover:text-primary"
							>
								Return to Main Page
							</BasicLink>
						</nav>

						<nav aria-label="Sheets navigation" className="sm:hidden">
							<Ariakit.MenuProvider placement="bottom-end">
								<Ariakit.MenuButton
									aria-label="Open navigation menu"
									className="flex size-11 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-hover-row hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
								>
									<Icon name="menu" height={20} width={20} />
								</Ariakit.MenuButton>
								<Ariakit.Menu
									aria-label="Sheets navigation"
									className="z-50 min-w-[220px] rounded-lg border border-medium bg-overlay py-1.5"
									gutter={8}
								>
									<Ariakit.MenuItem
										className="flex min-h-11 cursor-pointer items-center px-4 label-md text-secondary transition-colors hover:bg-hover-row hover:text-primary focus:bg-hover-row focus:text-primary focus:outline-hidden"
										render={
											<BasicLink
												href="https://docs.llama.fi/spreadsheet-functions/function-reference"
												data-umami-event="sheets-functions-reference-click"
											/>
										}
									>
										Functions Reference
									</Ariakit.MenuItem>
									<Ariakit.MenuItem
										className="flex min-h-11 cursor-pointer items-center px-4 label-md text-secondary transition-colors hover:bg-hover-row hover:text-primary focus:bg-hover-row focus:text-primary focus:outline-hidden"
										render={
											<BasicLink
												href="https://docs.llama.fi/spreadsheet-functions/templates"
												data-umami-event="sheets-templates-click-header"
											/>
										}
									>
										Templates
									</Ariakit.MenuItem>
									<Ariakit.MenuItem
										className="flex min-h-11 cursor-pointer items-center px-4 label-md text-secondary transition-colors hover:bg-hover-row hover:text-primary focus:bg-hover-row focus:text-primary focus:outline-hidden"
										render={<BasicLink href="/" />}
									>
										Return to Main Page
									</Ariakit.MenuItem>
								</Ariakit.Menu>
							</Ariakit.MenuProvider>
						</nav>
					</div>
				</header>

				<main className="grow">
					<SheetsContainer />
				</main>

				<footer className="mt-10 border-t border-subtle">
					<p className="mx-auto max-w-[1200px] px-4 pt-6 text-center body-md text-tertiary sm:px-6 md:px-8">
						If you have any questions or feedback, send it to{' '}
						<a
							href="mailto:support@defillama.com"
							className="text-secondary underline transition-colors hover:text-primary"
						>
							support@defillama.com
						</a>
					</p>
					<div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-4 px-4 py-6 body-md text-tertiary sm:px-6 md:justify-between md:px-8">
						<StaleText>{`© ${COPYRIGHT_YEAR} DefiLlama`}</StaleText>
						<div className="flex gap-5">
							<BasicLink href="/privacy-policy" className="text-secondary transition-colors hover:text-primary">
								Privacy Policy
							</BasicLink>
							<BasicLink href="/terms" className="text-secondary transition-colors hover:text-primary">
								Terms of Service
							</BasicLink>
						</div>
					</div>
				</footer>
			</div>
		</>
	)
}
