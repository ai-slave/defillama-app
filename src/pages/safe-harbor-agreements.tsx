import { createColumnHelper } from '@tanstack/react-table'
import type { InferGetStaticPropsType } from 'next'
import { BasicLink } from '~/components/Link'
import { ProtocolChainsHovercard } from '~/components/ProtocolChainsHovercard'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { getProtocolRankingsSnapshot } from '~/containers/ProtocolRankings/server/tableData.server'
import Layout from '~/layout'
import { Icon } from '~/ui/Icon'
import { slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatUsd } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('safe-harbor-agreements', async () => {
	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const protocolMetadata = metadataCache.protocolMetadata

	const [safeHarborProtocols, rankings] = await Promise.all([
		fetchJson<Record<string, boolean>>('https://api.llama.fi/_fe/static/safe-harbor-projects'),
		getProtocolRankingsSnapshot({
			chain: 'All',
			chainMetadata: metadataCache.chainMetadata,
			protocolMetadata: metadataCache.protocolMetadata,
			categoriesAndTagsMetadata: metadataCache.categoriesAndTags
		})
	])
	if (!rankings) throw new Error('All-chain protocol rankings are unavailable')
	const { protocols } = rankings

	const tvlByProtocol: Record<string, number | null> = {}
	const feesByProtocol: Record<string, number | null> = {}
	const revenueByProtocol: Record<string, number | null> = {}
	const dexVolumeByProtocol: Record<string, number | null> = {}
	for (const protocol of protocols) {
		tvlByProtocol[protocol.name] = protocol.tvl?.default?.tvl ?? null
		feesByProtocol[protocol.name] = protocol.fees?.total24h ?? null
		revenueByProtocol[protocol.name] = protocol.revenue?.total24h ?? null
		dexVolumeByProtocol[protocol.name] = protocol.dexs?.total24h ?? null
	}

	const finalProtocols: Array<SafeHarborRow> = []
	for (const protocolId in safeHarborProtocols) {
		const pmetadata = protocolMetadata[protocolId]
		const displayName = pmetadata?.displayName
		const chains = pmetadata?.chains
		if (safeHarborProtocols[protocolId] && displayName && chains) {
			finalProtocols.push({
				defillamaId: protocolId,
				name: displayName,
				slug: slug(displayName),
				chains,
				logo: tokenIconUrl(displayName),
				url: `https://safeharbor.securityalliance.org/database/${slug(displayName)}`,
				tvl: tvlByProtocol[displayName] ?? null,
				fees: feesByProtocol[displayName] ?? null,
				revenue: revenueByProtocol[displayName] ?? null,
				dexVolume: dexVolumeByProtocol[displayName] ?? null
			})
		}
	}

	finalProtocols.sort((a, b) => {
		if (a.tvl === null) return b.tvl === null ? 0 : 1
		if (b.tvl === null) return -1
		return b.tvl - a.tvl
	})

	return {
		props: {
			protocols: finalProtocols
		},
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Safe Harbor Agreements']
const DEFAULT_SORTING_STATE = [{ id: 'tvl', desc: true }]

export default function SafeHarborAgreements({ protocols }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Safe Harbor Agreements - DefiLlama"
			description="Browse DeFi protocols with safe harbor agreements. Track which projects have adopted security frameworks to protect white-hat hackers."
			canonicalUrl="/safe-harbor-agreements"
			pageName={pageName}
		>
			<TableWithSearch
				data={protocols}
				columns={columns}
				placeholder="Search protocols..."
				columnToSearch="name"
				header="Safe Harbor Agreements"
				headingAs="h1"
				compact
				csvFileName="safe-harbor-agreements"
				sortingState={DEFAULT_SORTING_STATE}
			/>
		</Layout>
	)
}

type SafeHarborRow = {
	defillamaId: string
	name: string
	url: string
	chains: Array<string>
	slug: string
	logo: string
	tvl: number | null
	fees: number | null
	revenue: number | null
	dexVolume: number | null
}

const columnHelper = createColumnHelper<SafeHarborRow>()

const columns = [
	columnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()

			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${row.original.name}`} />

					{row.original.chains.length > 0 ? (
						<span className="-my-2 flex flex-col">
							<BasicLink
								href={`/protocol/${row.original.slug}`}
								className="truncate text-sm font-medium text-link hover:underline"
							>
								{value}
							</BasicLink>

							<ProtocolChainsHovercard chains={row.original.chains} />
						</span>
					) : (
						<BasicLink
							href={`/protocol/${row.original.slug}`}
							className="truncate text-sm font-medium text-link hover:underline"
						>
							{value}
						</BasicLink>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(280px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.tvl ?? undefined, {
		id: 'tvl',
		header: 'TVL',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.fees ?? undefined, {
		id: 'fees',
		header: '24h Fees',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.revenue ?? undefined, {
		id: 'revenue',
		header: '24h Revenue',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[125px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.dexVolume ?? undefined, {
		id: 'dexVolume',
		header: '24h DEX Volume',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[150px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('url', {
		header: 'Agreement',
		enableSorting: false,
		cell: ({ row }) => (
			<a
				href={row.original.url}
				target="_blank"
				rel="noopener noreferrer"
				className="flex shrink-0 items-center justify-center rounded-md bg-brand-muted px-6 py-1.5 hover:bg-(--interim-brand-tint-hover)"
			>
				<Icon name="arrow-up-right" height={14} width={14} />
				<span className="sr-only">open in new tab</span>
			</a>
		),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	})
]
