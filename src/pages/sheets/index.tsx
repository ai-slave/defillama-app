import * as Ariakit from '@ariakit/react'
import Head from 'next/head'
import { BasicLink } from '~/components/Link'
import { LinkPreviewCard, SEO } from '~/components/SEO'
import SheetsContainer from '~/containers/Sheets'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/PopoverSurface'
import { StaleText } from '~/ui/StaleText'
import { Tooltip } from '~/ui/Tooltip'
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
							<Button
								as={BasicLink}
								href="https://docs.llama.fi/spreadsheet-functions/function-reference"
								data-umami-event="sheets-functions-reference-click"
								variant="ghost"
								size="md"
							>
								Functions Reference
							</Button>
							<Button
								as={BasicLink}
								href="https://docs.llama.fi/spreadsheet-functions/templates"
								data-umami-event="sheets-templates-click-header"
								variant="ghost"
								size="md"
							>
								Templates
							</Button>
							<Button as={BasicLink} href="/" variant="ghost" size="md">
								Return to Main Page
							</Button>
						</nav>

						<nav aria-label="Sheets navigation" className="sm:hidden">
							<Ariakit.MenuProvider placement="bottom-end">
								<Tooltip
									// In place: a portal would render it outside this page\'s theme-dark scope.
									portal={false}
									content="Open navigation menu"
									render={
										<Ariakit.MenuButton
											aria-label="Open navigation menu"
											render={<Button variant="ghost" size="md" square />}
										/>
									}
								>
									<Icon name="menu" className="size-4" aria-hidden="true" />
								</Tooltip>
								{/* Portaled like every menu (an in-place drawer would be positioned inside a blurred or sticky header), so it
								    carries this page's always-dark scope itself. */}
								<MenuSurface variant="actions" className="theme-dark" aria-label="Sheets navigation">
									<MenuItem
										render={
											<BasicLink
												href="https://docs.llama.fi/spreadsheet-functions/function-reference"
												data-umami-event="sheets-functions-reference-click"
											/>
										}
									>
										Functions Reference
									</MenuItem>
									<MenuItem
										render={
											<BasicLink
												href="https://docs.llama.fi/spreadsheet-functions/templates"
												data-umami-event="sheets-templates-click-header"
											/>
										}
									>
										Templates
									</MenuItem>
									<MenuItem render={<BasicLink href="/" />}>Return to Main Page</MenuItem>
								</MenuSurface>
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
