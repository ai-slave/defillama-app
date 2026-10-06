import { Head, Html, Main, NextScript, type DocumentProps } from 'next/document'
import { getInvestorsRootRedirectScript } from '~/containers/Investors/config'
import { getHeadBootstrapScript } from '~/utils/cookies'

export default function Document(props: DocumentProps) {
	const isMainLanding = props.__NEXT_DATA__.page === '/'
	return (
		<Html lang="en">
			<Head>
				<link rel="dns-prefetch" href="https://tasty.defillama.com" />

				<link rel="icon" type="image/png" sizes="96x96" href="/icons/favicon-96x96.png" />
				<link rel="icon" type="image/png" sizes="48x48" href="/icons/favicon-48x48.png" />
				<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
				<link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
				<link rel="icon" type="image/svg+xml" sizes="any" href="/icons/favicon.svg" />
				<link rel="icon" href="/favicon.ico" />
				<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
				<link rel="manifest" href="/manifest.json" />
				<meta name="apple-itunes-app" content="app-id=6761379469" />
				<link href="/fonts/inter.woff2" rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" />
				<link href="/fonts/jetbrains.ttf" rel="preload" as="font" type="font/ttf" crossOrigin="anonymous" />
				<link href="/icons/v50.svg" rel="prefetch" as="image" type="image/svg+xml" />
				<link href="/assets/defillama.webp" rel="preload" as="image" type="image/webp" />
				<script
					// eslint-disable-next-line react/no-danger -- an inline head script has no React equivalent; the source is local
					dangerouslySetInnerHTML={{
						__html: getHeadBootstrapScript()
					}}
				/>
				{isMainLanding ? (
					<script
						// eslint-disable-next-line react/no-danger -- an inline head script has no React equivalent; the source is local
						dangerouslySetInnerHTML={{
							__html: getInvestorsRootRedirectScript()
						}}
					/>
				) : null}
			</Head>
			<body>
				<Main />
				<NextScript />
			</body>
		</Html>
	)
}
