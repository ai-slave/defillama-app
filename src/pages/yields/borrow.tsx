import Layout from '~/layout'
import YieldPageBorrow from '~/components/YieldsPage/indexBorrow'
import Announcement from '~/components/Announcement'
import { disclaimer } from '~/components/YieldsPage/utils'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('yields/borrow', async () => {
	return {
		redirect: {
			destination: '/yields',
			permanent: true
		}
	}
})

export default function YieldBorrow() {
	return <div></div>
}
