import type { GetServerSideProps } from 'next'
import Layout from '~/layout'
import { canonicalRouteRedirect, encodeRouteSegment, getSingleRouteParam } from '~/utils/route'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

const getServerSidePropsHandler: GetServerSideProps = async (context) => {
	const pool = getSingleRouteParam(context.params?.pool)
	if (!pool) return { notFound: true }

	return canonicalRouteRedirect(`/yields/pool/${encodeRouteSegment(pool)}`, true)
}

export default function YieldPoolPage() {
	return (
		<Layout title="DeFi Yield Pool Chart & Analytics - DefiLlama" description={null} canonicalUrl={null} noIndex>
			<></>
		</Layout>
	)
}

export const getServerSideProps = withServerSidePropsTelemetry('/yields/borrow/[pool]', getServerSidePropsHandler)
