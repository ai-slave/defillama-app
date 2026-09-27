import { createColumnHelper } from '@tanstack/react-table'
import type { InferGetStaticPropsType } from 'next'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { fetchProtocolExpenses } from '~/containers/ProtocolOverview/api'
import { buildProtocolExpenseRows } from '~/containers/ProtocolOverview/expenses'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { PanelTitle, PanelHeader } from '~/ui/Panel'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatUsd } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('expenses', async () => {
	const [{ protocols, parentProtocols }, expenses] = await Promise.all([fetchProtocols(), fetchProtocolExpenses()])

	return {
		props: { expenses: buildProtocolExpenseRows({ expenses, parentProtocols, protocols }) },
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Protocols', 'ranked by', 'Expenses']
const DEFAULT_SORTING_STATE = [{ id: 'sumAnnualUsdExpenses', desc: true }]

type ExpenseRow = InferGetStaticPropsType<typeof getStaticProps>['expenses'][number]

const columnHelper = createColumnHelper<SearchTableFeatures, ExpenseRow>()

function isDeprecatedProtocol(
	protocol: ExpenseRow['protocol']
): protocol is Extract<ExpenseRow['protocol'], { deprecated?: boolean }> {
	return !!protocol && 'deprecated' in protocol && protocol.deprecated === true
}

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Protocol Expense Rankings - DefiLlama"
			description="Track DeFi protocol expenses and token incentive costs. Compare operational spending across protocols to evaluate sustainability."
			canonicalUrl="/expenses"
			pageName={pageName}
		>
			<SearchTableProvider
				options={{ data: props.expenses, columns, initialState: { sorting: DEFAULT_SORTING_STATE } }}
			>
				<Card padding="none">
					<PanelHeader>
						<PanelTitle as="h1" className="whitespace-nowrap">
							Protocol Expenses
						</PanelTitle>
						<TableSearchInput
							columnId="name"
							placeholder="Search protocol..."
							className={searchFieldInlineWrapperStyles}
						/>
						<TableCsvExport filename="protocol-expenses" />
					</PanelHeader>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</Layout>
	)
}

const columns = columnHelper.columns([
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
							className="min-w-0 truncate text-sm font-medium text-link hover:underline"
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
	columnHelper.accessor((row) => row.headcount ?? undefined, {
		id: 'headcount',
		header: 'Headcount',
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.sumAnnualUsdExpenses ?? undefined, {
		id: 'sumAnnualUsdExpenses',
		header: 'Annual Expenses',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[150px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('sources', {
		header: 'Source',
		enableSorting: false,
		cell: ({ getValue }) => {
			const source = getValue()?.[0]
			return source ? (
				<Tooltip
					content={source}
					render={<a href={source} target="_blank" rel="noopener noreferrer" aria-label="View source" />}
					className="hover-wash flex shrink-0 items-center justify-center rounded-md bg-brand-muted px-2.5 py-1 label-sm whitespace-nowrap text-link"
				>
					<Icon name="arrow-up-right" height={14} width={14} className="shrink-0" />
				</Tooltip>
			) : null
		},
		meta: {
			headerClassName: 'w-[90px]'
		}
	})
])
