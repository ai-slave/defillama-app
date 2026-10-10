import Head from 'next/head'
import { TemporarilyDisabledPage } from '~/components/TemporarilyDisabledPage'

export default function Liquidity() {
	return (
		<>
			<Head>
				<link rel="icon" type="image/png" href="/favicon-32x32.png" />
			</Head>
			{/* <iframe
				title="Token Liquidity"
				className="col-span-full -mb-4 h-screen w-full border-0"
				src="https://swap.defillama.com/token-liquidity"
				sandbox="allow-scripts"
			/> */}
			<TemporarilyDisabledPage
				title="Token Liquidity - DefiLlama"
				description="Check token liquidity and swap depth across decentralized exchanges on DefiLlama."
				canonicalUrl="/liquidity"
				heading="Token liquidity is unavailable"
			>
				Token liquidity data is not available on DefiLlama for now. This page returns in a future update.
			</TemporarilyDisabledPage>
		</>
	)
}
