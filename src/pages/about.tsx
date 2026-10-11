import type { InferGetStaticPropsType } from 'next'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('about', async () => {
	const [metadataCache, { acquireYieldsSnapshot, readEarn }] = await Promise.all([
		import('~/utils/metadata').then((m) => m.default),
		import('~/containers/Yields/server/dataset.server')
	])
	const yields = await readEarn(await acquireYieldsSnapshot('blocking'))
	const { protocolMetadata, chainMetadata } = metadataCache

	let allProtocols = 0
	let revenueProtocols = 0
	let dexsProtocols = 0
	let chains = 0

	for (const protocolId in protocolMetadata) {
		if (protocolId.startsWith('parent#')) continue
		const metadata = protocolMetadata[protocolId]
		allProtocols++
		if (metadata.revenue) revenueProtocols++
		if (metadata.dexs) dexsProtocols++
	}

	for (const _chain in chainMetadata) {
		chains++
	}

	return {
		props: {
			protocols: allProtocols,
			chains,
			pools: yields.length,
			revenue: revenueProtocols,
			dexs: dexsProtocols
		},
		revalidate: maxAgeForNext([22])
	}
})

function AboutPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="About DefiLlama - DeFi Dashboard & Crypto Analytics"
			description="Learn about DefiLlama, the largest open-source DeFi dashboard and crypto analytics platform. Track 7000+ protocols on 500+ chains with fully transparent methodology. No ads, no sponsored content—just accurate DeFi data."
			canonicalUrl="/about"
		>
			<Card as="section" padding="sm" className="flex flex-col gap-4">
				<h1 className="heading-xs">About DefiLlama</h1>
				<hr className="border-subtle" />
				<p>
					DefiLlama is the largest TVL aggregator for DeFi (Decentralized Finance). Our data is fully{' '}
					<a
						className="text-link hover:underline"
						target="_blank"
						rel="noopener noreferrer"
						href="https://github.com/DefiLlama/DefiLlama-Adapters"
					>
						open-source
					</a>{' '}
					and maintained by a team of passionate individuals and{' '}
					<a
						className="text-link hover:underline"
						target="_blank"
						rel="noopener noreferrer"
						href="https://github.com/DefiLlama/DefiLlama-Adapters/graphs/contributors"
					>
						contributors
					</a>{' '}
					from hundreds of protocols.
				</p>
				<p>Our focus is on accurate data and transparent methodology.</p>
			</Card>

			{props.protocols && props.chains ? (
				<Card as="section" padding="sm" className="flex flex-col gap-4">
					<h2 className="heading-xs">Stats</h2>
					<hr className="border-subtle" />
					<div>
						<p>We track:</p>
						<ul className="list-inside list-disc">
							<li>{props.protocols} protocols</li>
							<li>{props.chains} chains</li>
							<li>{props.pools} pools</li>
							<li>Revenue for {props.revenue} protocols</li>
							<li>Volume for {props.dexs} DEXs</li>
						</ul>
					</div>
				</Card>
			) : null}

			<Card as="section" padding="sm" className="flex flex-col gap-4">
				<h2 className="heading-xs">For university students</h2>
				<hr className="border-subtle" />
				<p>
					University students who need DefiLlama for their coursework or research can request free access to our Pro and
					API plans. To request access, email{' '}
					<a className="text-link hover:underline" href="mailto:support@defillama.com">
						support@defillama.com
					</a>{' '}
					from your university-issued .edu address, with a brief description of what you’re working on and the name of
					your university.
				</p>
			</Card>

			<Card as="section" padding="sm" className="flex flex-col gap-4">
				<h2 className="heading-xs">Contact</h2>
				<hr className="border-subtle" />
				<p>
					The best way to contact us and the one in which you'll get a reply the fastest is through our{' '}
					<a className="text-link hover:underline" target="_blank" rel="noopener noreferrer" href="/support">
						our support page
					</a>
					.
				</p>
				<p>
					For questions around product, methodology, data, etc. You'll get much faster responses by using our priority
					support, available{' '}
					<a
						className="text-link hover:underline"
						target="_blank"
						rel="noopener noreferrer"
						href="https://defillama.com/subscription"
					>
						here after subscribing
					</a>
				</p>
				<p>
					DefiLlama is a part of{' '}
					<a
						className="text-link hover:underline"
						target="_blank"
						rel="noopener noreferrer"
						href="https://x.com/llamacorporg"
					>
						Llama Corp
					</a>
					.
				</p>
				<p>
					Llama Corp is a collective building out the decentralized future with data analytics, infrastructure,
					payments, cross-chain and media solutions used by more than 10M monthly users.
				</p>
			</Card>

			<Card as="section" padding="sm" className="flex flex-col gap-4">
				<h2 className="heading-xs">Acknowledgements</h2>
				<hr className="border-subtle" />
				<p>
					Thanks to{' '}
					<a className="text-link hover:underline" target="_blank" rel="noopener noreferrer" href="https://allium.so/">
						Allium
					</a>{' '}
					for their indexer service.
				</p>
			</Card>
		</Layout>
	)
}

export default AboutPage
