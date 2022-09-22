import * as React from 'react'
import Layout from '~/layout'
import DexsContainer, { IDexsContainer } from '~/containers/DexsContainer'
import { revalidate } from '~/api'
import { getChainPageData } from '~/api/categories/dexs'

export async function getStaticProps() {
	const { props } = await getChainPageData()

	return {
		props,
		revalidate: revalidate()
	}
}

const Chains: React.FC<IDexsContainer> = (props) => {
	return (
		<Layout title={`${props.chain} volumes - DefiLlama`} defaultSEO>
			<DexsContainer {...props} />
		</Layout>
	)
}

export default Chains
