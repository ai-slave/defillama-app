import { readFileSync } from 'node:fs'
import Head from 'next/head'
import { DESIGN_SYSTEM_PAGES, DesignSystem } from '~/containers/DesignSystem'
import { type ComponentRow, parseComponentTable } from '~/containers/DesignSystem/componentTable'

// A development tool: a production build answers 404 here unless it was built with DESIGN_SYSTEM_PAGE=true, which a
// preview deploy sets so a review can open it from a link. It renders without the app shell, so nothing but the
// tokens and components under review is on the page. /dev/design-system stacks every page ("All"); each foundation
// and family has its own path, so the server renders the page the URL names. In development this runs on every
// request, so an edit to design.md shows on the next reload.
export const getStaticPaths = () => ({
	paths:
		process.env.NODE_ENV === 'production' && process.env.DESIGN_SYSTEM_PAGE !== 'true'
			? []
			: [{ params: { page: [] } }, ...DESIGN_SYSTEM_PAGES.map((page) => ({ params: { page: [page] } }))],
	fallback: false
})

// A production build without the flag lists no paths and falls back to nothing, so getStaticProps never runs there.
// With the flag it runs once at build time, so the page shows design.md as of that build.
export const getStaticProps = ({ params }: { params: { page?: Array<string> } }) => ({
	props: {
		page: params.page?.[0] ?? null,
		rows: parseComponentTable(readFileSync('design.md', 'utf8'))
	}
})

export default function DesignSystemPage({ page, rows }: { page: string | null; rows: Array<ComponentRow> }) {
	return (
		<>
			<Head>
				<title>Design system</title>
				<meta name="robots" content="noindex" />
			</Head>
			<DesignSystem page={page} rows={rows} />
		</>
	)
}
