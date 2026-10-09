import Head from 'next/head'
import { BasicLink } from '~/components/Link'
import { LinkPreviewCard } from '~/components/SEO'
import MCPContainer from '~/containers/MCP'
import { Button } from '~/ui/Button'
import { StaleText } from '~/ui/StaleText'
import { COPYRIGHT_YEAR } from '~/utils/copyrightYear'

export default function MCP() {
	return (
		<>
			<Head>
				<title>DefiLlama MCP: DeFi Data for AI Agents</title>
				<meta
					name="description"
					content="Connect Claude, Cursor, and other AI agents to DefiLlama's DeFi analytics. 23 tools for TVL, token prices, yields, protocol metrics, and more."
				/>
				<link rel="icon" type="image/png" href="/favicon-32x32.png" />
			</Head>
			<LinkPreviewCard />
			<div className="col-span-full flex min-h-screen w-full flex-col bg-page font-inter text-primary">
				<header className="sticky top-0 z-50 border-b border-subtle bg-page-glass backdrop-blur-md">
					<div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-4 sm:px-6 md:px-8">
						<BasicLink href="/" className="flex items-center gap-2.5">
							<img src="/assets/llama.webp" alt="DefiLlama" width={28} height={28} className="rounded-full" />
							<span className="title-md tracking-tight">DefiLlama</span>
						</BasicLink>

						<nav className="flex items-center gap-1">
							<Button as={BasicLink} href="#tools" variant="ghost" size="md">
								Tools
							</Button>
							<Button as={BasicLink} href="#setup" variant="ghost" size="md">
								Setup
							</Button>
							<Button as={BasicLink} href="/" variant="ghost" size="md">
								Back to Main
							</Button>
						</nav>
					</div>
				</header>

				<main className="grow">
					<MCPContainer />
				</main>

				<footer className="border-t border-subtle">
					<p className="mx-auto max-w-[1100px] px-4 pt-6 text-center body-sm text-secondary sm:px-6 md:px-8">
						Questions or feedback?{' '}
						<a
							href="mailto:support@defillama.com"
							className="text-secondary underline transition-colors hover:text-primary"
						>
							support@defillama.com
						</a>
					</p>
					<div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-center gap-4 px-4 py-6 body-sm text-secondary sm:px-6 md:justify-between md:px-8">
						<StaleText>{`© ${COPYRIGHT_YEAR} DefiLlama`}</StaleText>
						<div className="flex gap-5">
							<BasicLink href="/privacy-policy" className="transition-colors hover:text-primary">
								Privacy Policy
							</BasicLink>
							<BasicLink href="/terms" className="transition-colors hover:text-primary">
								Terms of Service
							</BasicLink>
						</div>
					</div>
				</footer>
			</div>
		</>
	)
}
