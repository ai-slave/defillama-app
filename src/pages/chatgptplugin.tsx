import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'

function PluginPage() {
	return (
		<Layout
			title="DefiLlama ChatGPT Plugin - DeFi Data Assistant"
			description="Access DefiLlama DeFi data through the ChatGPT plugin. Query TVL, protocol stats, chain data, and more using natural language."
			canonicalUrl="/chatgptplugin"
		>
			<EntityTitleStrip title="DefiLlama ChatGPT plugin" />

			<Card as="section" padding="sm" className="flex flex-col gap-4">
				<h2 className="heading-xs">About</h2>
				<hr className="border-subtle" />
				<p>
					DefiLlama is the most popular DeFi (Decentralized Finance) data aggregator. The DefiLlama ChatGPT plugin
					retrieves current and historical data on blockchains, DeFi applications and bridges.
				</p>
			</Card>

			<Card as="section" padding="sm" className="flex flex-col gap-4">
				<h2 className="heading-xs">Best practices</h2>
				<hr className="border-subtle" />
				<p>To achieve the best results from the plugin, follow these steps:</p>
				<p>1. Ask "What features do you have?" to see the most recent feature list.</p>
				<p>
					2. Select a question to ask from the feature list. For instance, if you want to learn about DEX trading
					activity, the feature list will show you that the plugin can answer questions about the volume of a specific
					DEX or provide a ranking of DEXs by volume.
				</p>
				<p>
					Optional: Many of the features have filtering options that you can use to tailor your question. These
					filtering options are shared in the feature list. For example, if you ask for top yield pools, you can filter
					by chain, stablecoin usage, single-sided, and the future outlook for the yield rate (stable, up, down).
					Therefore, you could ask "Give me the top 10 stablecoin yields on Polygon that are single-sided".
				</p>
				<p>
					If you have any feedback or bug reports, please log them here:{' '}
					<a
						className="text-link hover:underline"
						target="_blank"
						rel="noopener noreferrer"
						href="https://form.typeform.com/to/tJkEGYxQ"
					>
						Feedback Form
					</a>
				</p>
			</Card>

			<Card as="section" padding="sm" className="flex flex-col gap-4">
				<h2 className="heading-xs">Legal</h2>
				<hr className="border-subtle" />
				<p>
					The DefiLlama ChatGPT plugin does not sell user data. The plugin does not collect any identifying user data.
				</p>
				<p>
					The DefiLlama Plugin uses{' '}
					<a target="_blank" rel="noopener noreferrer" href="https://posthog.com/">
						PostHog
					</a>{' '}
					to track anonymized product analytics. Visit{' '}
					<a target="_blank" rel="noopener noreferrer" href="https://posthog.com/privacy">
						PostHog’s Privacy Policy
					</a>{' '}
					to learn more about how they handle data.
				</p>
			</Card>
		</Layout>
	)
}

export default PluginPage
