import Head from 'next/head'
import { DesignSystem } from '~/containers/DesignSystem'

// A development tool: a production build answers 404 here. It renders without the app shell, so nothing but the
// tokens and components under review is on the page.
export const getStaticProps = () => (process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} })

export default function DesignSystemPage() {
	return (
		<>
			<Head>
				<title>Design system</title>
				<meta name="robots" content="noindex" />
			</Head>
			<DesignSystem />
		</>
	)
}
