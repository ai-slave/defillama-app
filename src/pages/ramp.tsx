import type { RampCatalogModel } from '~/containers/Exchanges/models'
import { RampTable } from '~/containers/Exchanges/RampTable'
import { loadMasterRampCatalog } from '~/containers/Exchanges/server/master.loaders'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatNumber } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'

interface RampPageProps {
	catalog: RampCatalogModel | null
}

export const getStaticProps = withPerformanceLogging<RampPageProps>('ramp', async () => {
	// Fail-soft, like the other master-file consumers: a missing/unreachable
	// ramps.json renders the empty state instead of failing the whole build.
	const catalog = await loadMasterRampCatalog().catch(() => null)
	return { props: { catalog }, revalidate: maxAgeForNext([22]) }
})

export const RAMP_PAGE_METADATA = {
	title: 'Fiat on-ramp and off-ramp costs - DefiLlama',
	description:
		'Compare what it actually costs to move money into crypto and back out: fiat deposit and withdrawal fees, trading fees, order-book slippage and BTC transfer fees, per country and currency.',
	canonicalUrl: '/ramp',
	pageName: ['Exchanges']
}

export default function RampPage({ catalog }: RampPageProps) {
	const networkFee = catalog?.btcNetworkFeeBtc ?? null
	return (
		<Layout {...RAMP_PAGE_METADATA}>
			<header className="flex flex-col gap-1 px-1 pb-2">
				<h1 className="heading-sm">Fiat on-ramp and off-ramp costs</h1>
				<p className="body-sm text-secondary">
					The full cost of the round trip, priced on each venue&apos;s BTC book: fiat rail fee + taker fee + order-book
					slippage + the BTC transfer leg. Pick your country to get the rails, verification and availability that apply
					there.
				</p>
			</header>
			{catalog?.venues.length ? (
				<>
					<RampTable catalog={catalog} />
					<Card as="aside" padding="sm" className="body-sm text-secondary">
						<p>
							Slippage walks each venue&apos;s stored daily BTC order-book snapshot — nothing is venue-reported.
							{networkFee == null
								? ' '
								: ` Off-ramp deposits assume a ${formatNumber(networkFee, { maximumFractionDigits: 8 })} BTC network fee (a typical 1-in-2-out segwit transaction at the ~30 minute rate). `}
							A blank cost means one leg is unpublished, never that it is free. BTC only, so every venue is compared on
							the one asset they all list.
						</p>
					</Card>
				</>
			) : (
				<Card padding="md" className="text-center body-sm text-secondary">
					<p>No venues with published fiat rails are present in the current catalog.</p>
				</Card>
			)}
		</Layout>
	)
}
