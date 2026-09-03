import type { InferGetStaticPropsType } from 'next'
import { EquitiesOverview } from '~/containers/Equities'
import { getEquitiesSnapshot, getEquitiesTablePage } from '~/containers/Equities/server/tableData.server'
import type { IEquitiesListPageProps } from '~/containers/Equities/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('equities/index', async () => {
	// Only the default first page ships with the HTML; every other view fetches from /api/public/equities.
	const snapshot = await getEquitiesSnapshot()
	const props: IEquitiesListPageProps = {
		initialData: await getEquitiesTablePage(snapshot, {}),
		initialDataGeneratedAt: snapshot.generatedAt
	}

	return {
		props,
		revalidate: maxAgeForNext([5])
	}
})

export default function EquitiesIndexPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Equities Rankings - DefiLlama"
			description="Track public equities by market cap, price, trading volume, returns, valuation, sector, and industry."
			canonicalUrl="/equities"
			pageName={['Equities']}
		>
			<EquitiesOverview {...props} />
		</Layout>
	)
}
