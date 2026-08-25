import { createColumnHelper } from '@tanstack/react-table'
import { BasicLink } from '~/components/Link'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import type { PreIpoPerpIntegration, PreIpoTokenIssuerIntegration } from './api.types'

function formatMoney(value: number | null | undefined): string {
	return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, maximumFractionDigits: 2 }) ?? '-'
}

function IntegrationLink({ href, label }: { href: string; label: string }) {
	return (
		<BasicLink
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			title={label}
			className="inline-flex max-w-full items-center gap-1 text-link hover:underline"
		>
			<span className="truncate">{label}</span>
			<Icon name="arrow-up-right" height={14} width={14} className="shrink-0" aria-hidden="true" />
		</BasicLink>
	)
}

function EmptyIntegrationTable({ title, message }: { title: string; message: string }) {
	return (
		<Panel padding="none">
			<PanelHeader>
				<PanelTitle>{title}</PanelTitle>
			</PanelHeader>
			<p className="p-8 text-center body-md text-secondary">{message}</p>
		</Panel>
	)
}

const perpColumnHelper = createColumnHelper<PreIpoPerpIntegration>()
const perpColumns = [
	perpColumnHelper.accessor('exchangeName', {
		header: 'Exchange',
		enableSorting: false,
		meta: { headerClassName: 'w-[150px]', align: 'start' }
	}),
	perpColumnHelper.accessor('exchangeType', {
		header: 'Type',
		enableSorting: false,
		meta: { headerClassName: 'w-[80px]', align: 'start' }
	}),
	perpColumnHelper.accessor('defillamaContract', {
		header: 'Contract',
		enableSorting: false,
		cell: ({ getValue, row }) => <IntegrationLink href={row.original.tradeUrl} label={getValue()} />,
		meta: { headerClassName: 'w-[240px] min-w-[240px]', align: 'start' }
	}),
	perpColumnHelper.accessor((row) => row.price ?? undefined, {
		id: 'price',
		header: 'Price',
		cell: ({ getValue }) => formatUsd(getValue(), { maximumFractionDigits: 4 }) ?? '-',
		meta: { headerClassName: 'w-[110px]', align: 'end' }
	}),
	perpColumnHelper.accessor((row) => row.volume ?? undefined, {
		id: 'volume',
		header: 'Volume',
		cell: ({ getValue }) => formatMoney(getValue()),
		meta: { headerClassName: 'w-[120px]', align: 'end' }
	}),
	perpColumnHelper.accessor((row) => row.openInterest ?? undefined, {
		id: 'openInterest',
		header: 'Open Interest',
		cell: ({ getValue }) => formatMoney(getValue()),
		meta: { headerClassName: 'w-[140px]', align: 'end' }
	}),
	perpColumnHelper.accessor((row) => row.annualizedFundingRate ?? undefined, {
		id: 'annualizedFundingRate',
		header: 'Annualized Funding',
		cell: ({ getValue }) =>
			formatPercent(getValue(), { input: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' }) ?? '-',
		meta: { headerClassName: 'w-[170px]', align: 'end' }
	}),
	perpColumnHelper.accessor((row) => row.estimatedValuation ?? undefined, {
		id: 'estimatedValuation',
		header: 'Estimated Valuation',
		cell: ({ getValue }) => formatMoney(getValue()),
		meta: { headerClassName: 'w-[170px]', align: 'end' }
	}),
	perpColumnHelper.accessor('tradeUrl', {
		header: 'Trade URL',
		enableSorting: false,
		meta: { hidden: true, csvOnly: true }
	})
]

const issuerColumnHelper = createColumnHelper<PreIpoTokenIssuerIntegration>()
const issuerColumns = [
	issuerColumnHelper.accessor('issuerName', {
		header: 'Issuer',
		enableSorting: false,
		cell: ({ getValue, row }) => <IntegrationLink href={row.original.productUrl} label={getValue()} />,
		meta: { headerClassName: 'w-[180px]', align: 'start' }
	}),
	issuerColumnHelper.accessor('backing', {
		header: 'Backing',
		enableSorting: false,
		meta: { headerClassName: 'w-[160px]', align: 'start' }
	}),
	issuerColumnHelper.accessor((row) => row.price ?? undefined, {
		id: 'price',
		header: 'Price',
		cell: ({ getValue }) => formatUsd(getValue(), { maximumFractionDigits: 4 }) ?? '-',
		meta: { headerClassName: 'w-[110px]', align: 'end' }
	}),
	issuerColumnHelper.accessor((row) => row.marketCap ?? undefined, {
		id: 'marketCap',
		header: 'Market Cap',
		cell: ({ getValue }) => formatMoney(getValue()),
		meta: { headerClassName: 'w-[140px]', align: 'end' }
	}),
	issuerColumnHelper.accessor((row) => row.estimatedValuation ?? undefined, {
		id: 'estimatedValuation',
		header: 'Estimated Valuation',
		cell: ({ getValue }) => formatMoney(getValue()),
		meta: { headerClassName: 'w-[170px]', align: 'end' }
	}),
	issuerColumnHelper.accessor('productUrl', {
		header: 'Product URL',
		enableSorting: false,
		meta: { hidden: true, csvOnly: true }
	})
]

export function PerpetualMarketsTable({ companyName, perps }: { companyName: string; perps: PreIpoPerpIntegration[] }) {
	if (perps.length === 0) {
		return <EmptyIntegrationTable title="Perpetual Markets" message="No perpetual markets available." />
	}
	return (
		<TableWithSearch
			data={perps}
			columns={perpColumns}
			header="Perpetual Markets"
			placeholder="Search exchanges..."
			columnToSearch="exchangeName"
			csvFileName={`${companyName}-perpetual-markets`}
			skipVirtualization
		/>
	)
}

export function TokenIssuersTable({
	companyName,
	tokenIssuers
}: {
	companyName: string
	tokenIssuers: PreIpoTokenIssuerIntegration[]
}) {
	if (tokenIssuers.length === 0) {
		return <EmptyIntegrationTable title="Token Issuers" message="No token issuer markets available." />
	}
	return (
		<TableWithSearch
			data={tokenIssuers}
			columns={issuerColumns}
			header="Token Issuers"
			placeholder="Search issuers..."
			columnToSearch="issuerName"
			csvFileName={`${companyName}-token-issuers`}
			skipVirtualization
		/>
	)
}
