import { createColumnHelper } from '@tanstack/react-table'
import type { InferGetStaticPropsType } from 'next'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { ParentProtocolLite, ProtocolLite } from '~/containers/ProtocolLists/api.types'
import { fetchProtocolExpenses } from '~/containers/ProtocolOverview/api'
import Layout from '~/layout'
import { formattedNum, slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('expenses', async () => {
	const [{ protocols, parentProtocols }, expenses] = await Promise.all([fetchProtocols(), fetchProtocolExpenses()])

	const protocolById = new Map<string, ProtocolLite | (ParentProtocolLite & { defillamaId: string })>()
	for (const p of protocols) protocolById.set(p.defillamaId, p)
	for (const p of parentProtocols) protocolById.set(p.id, { ...p, defillamaId: p.id })

	return {
		props: {
			expenses: expenses
				.map((e) => {
					const protocol = protocolById.get(e.protocolId) ?? null
					const sumAnnualUsdExpenses = Object.values(e.annualUsdCost).reduce(
						(sum: number, x: number) => sum + x
					) as number
					return {
						...e,
						name: protocol?.name ?? '',
						protocol,
						avgCostPerFTE: sumAnnualUsdExpenses / e.headcount,
						sumAnnualUsdExpenses
					}
				})
				.sort((a, b) => b.sumAnnualUsdExpenses - a.sumAnnualUsdExpenses)
		},
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Protocols', 'ranked by', 'Expenses']
const DEFAULT_SORTING_STATE = [{ id: 'sumAnnualUsdExpenses', desc: true }]

type ExpenseRow = InferGetStaticPropsType<typeof getStaticProps>['expenses'][number]

const columnHelper = createColumnHelper<ExpenseRow>()

function isDeprecatedProtocol(
	protocol: ExpenseRow['protocol']
): protocol is Extract<ExpenseRow['protocol'], { deprecated?: boolean }> {
	return !!protocol && 'deprecated' in protocol && protocol.deprecated === true
}

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title={`Protocol Expense Rankings - DefiLlama`}
			description="Track DeFi protocol expenses and token incentive costs. Compare operational spending across protocols to evaluate sustainability."
			canonicalUrl={`/expenses`}
			pageName={pageName}
		>
			<TableWithSearch
				data={props.expenses}
				columns={columns}
				columnToSearch={'name'}
				placeholder={'Search protocol...'}
				header={'Protocol Expenses'}
				headingAs="h1"
				csvFileName="protocol-expenses"
				sortingState={DEFAULT_SORTING_STATE}
			/>
		</Layout>
	)
}

const columns = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo src={row.original.protocol?.logo} data-lgonly alt={`Logo of ${value}`} />
					<span className="flex items-center gap-1 overflow-hidden">
						<BasicLink
							href={`/protocol/${slug(value)}`}
							className="min-w-0 overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap text-(--link-text) hover:underline"
						>
							{value}
						</BasicLink>
						{isDeprecatedProtocol(row.original.protocol) ? <DeprecatedProtocolMarker /> : null}
					</span>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	columnHelper.accessor('headcount', {
		header: 'Headcount',
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('sumAnnualUsdExpenses', {
		header: 'Annual Expenses',
		cell: (info) => (info.getValue() != null ? formattedNum(info.getValue(), true) : null),
		meta: {
			headerClassName: 'w-[150px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('sources', {
		header: 'Source',
		enableSorting: false,
		cell: ({ getValue }) =>
			getValue() ? (
				<a
					className="hover-wash flex shrink-0 items-center justify-center rounded-md bg-brand-muted px-2.5 py-1 label-sm whitespace-nowrap text-link"
					href={getValue()[0]}
					target="_blank"
					rel="noopener noreferrer"
				>
					<Icon name="arrow-up-right" height={14} width={14} className="shrink-0" />
				</a>
			) : null,
		meta: {
			headerClassName: 'w-[90px]'
		}
	})
]
