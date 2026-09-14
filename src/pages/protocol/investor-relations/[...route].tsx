import { ProtocolIrPage } from '~/containers/Investors/mainSiteProtocolIrPage'
import {
	createProtocolIrStaticProps,
	getProtocolIrStaticPaths
} from '~/containers/Investors/mainSiteProtocolIrStaticProps'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging(
	'protocol/investor-relations/[...route]',
	createProtocolIrStaticProps('investor-relations')
)

export const getStaticPaths = getProtocolIrStaticPaths

export default ProtocolIrPage
