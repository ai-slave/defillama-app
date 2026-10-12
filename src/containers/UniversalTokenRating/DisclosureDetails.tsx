import type { ReactNode } from 'react'
import type { HeadlessChartExportButtons } from '~/components/ChartExport/types'
import MultiSeriesChart from '~/components/ECharts/MultiSeriesChart'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import PieChart from '~/components/ECharts/PieChart'
import { CHART_COLORS } from '~/constants/colors'
import { SecondaryBadge } from '~/containers/MarketMakers/badges'
import { Card } from '~/ui/Card'
import { ChartPanelBody } from '~/ui/ChartPanel'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { EmptyState } from '~/ui/Status'
import { TagLink } from '~/ui/Tag'
import { formatPercent } from '~/utils/numberFormat'
import { UTR_PERCENT_OPTIONS } from './constants'
import { disclosedVestingDataset, disclosedVestingDurationMonths } from './disclosedVesting'
import { ChartCaption } from './TokenPage'
import type { UtrDisclosedAllocation, UtrDisclosedTokenomicsGroup, UtrDisclosures } from './types'

const HTTP_URL = /^https?:\/\//i
const EVM_ADDRESS = /^0x[0-9a-f]{40}$/i

export function tokenomicsGroupColor(index: number): string {
	return CHART_COLORS[index % CHART_COLORS.length]
}

export function formatDisclosedMonths(months: number | null): string {
	if (months == null) return 'N/A'
	return `${months} ${months === 1 ? 'month' : 'months'}`
}

function formatDisclosedPct(value: number): string {
	return formatPercent(value, UTR_PERCENT_OPTIONS) ?? 'N/A'
}

function formatAllocation(value: UtrDisclosedAllocation): string {
	if (value == null) return 'N/A'
	return typeof value === 'number' ? formatDisclosedPct(value) : value
}

function shortAddress(address: string): string {
	return EVM_ADDRESS.test(address) ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

/** Disclosed URLs are issuer-submitted text; only http(s) ones become links or images. */
export function httpHref(url: string | null): string | null {
	return url && HTTP_URL.test(url) ? url : null
}

function ExternalLink({ href }: { href: string | null }) {
	if (!href) return <span className="text-tertiary">N/A</span>
	const link = httpHref(href)
	if (!link) return <span className="break-all">{href}</span>
	return (
		<TagLink href={link} target="_blank" rel="noopener noreferrer nofollow" className="break-all">
			{link}
		</TagLink>
	)
}

function NamedLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
	const logo = httpHref(logoUrl)
	return (
		<span className="flex items-center gap-1.5">
			{logo ? <img src={logo} alt="" width={16} height={16} className="shrink-0 rounded-full" /> : null}
			{name}
		</span>
	)
}

function DisclosureTable({ columns, rows }: { columns: Array<string>; rows: Array<Array<ReactNode>> }) {
	return (
		<Card padding="none" className="shrink-0 overflow-x-auto">
			<table className="w-full min-w-[480px] border-collapse text-left">
				<thead>
					<tr>
						{columns.map((column) => (
							<th key={column} className="px-4 py-2 body-sm text-tertiary">
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((cells, rowIndex) => (
						// oxlint-disable-next-line react/no-array-index-key -- Disclosed rows have no stable id and are never reordered.
						<tr key={rowIndex} className="border-t border-subtle">
							{cells.map((cell, cellIndex) => (
								<td key={columns[cellIndex]} className="px-4 py-2 align-top body-sm text-primary">
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</Card>
	)
}

function Commentary({ title, text }: { title: string; text: string }) {
	return (
		<Card padding="strip" className="flex flex-col gap-2">
			<span className="body-sm text-tertiary">{title}</span>
			<p className="body-sm whitespace-pre-line text-primary">{text}</p>
		</Card>
	)
}

function NotDisclosed() {
	return <EmptyState size="md" framed icon="eye-off" title="Data not disclosed" className="min-h-32" />
}

const VESTING_CHART_OPTIONS = createCategoryChartOptions('%')

export function DisclosedVestingChart({
	dataset,
	exportButtons,
	actions
}: {
	dataset: MultiSeriesChartDataset
	exportButtons: HeadlessChartExportButtons
	actions?: ReactNode
}) {
	return (
		<>
			<ChartCaption actions={actions}>Disclosed Maximum Token Supply (%) | Months Since TGE</ChartCaption>
			<ChartPanelBody>
				<MultiSeriesChart
					dataset={dataset}
					charts={dataset.dimensions.slice(1).map((name, index) => ({
						type: 'bar' as const,
						name,
						encode: { x: 0, y: index + 1 },
						stack: 'vesting',
						color: tokenomicsGroupColor(index)
					}))}
					valueSymbol="%"
					chartOptions={VESTING_CHART_OPTIONS}
					showLegend
					hideDataZoom
					exportButtons={exportButtons}
				/>
			</ChartPanelBody>
		</>
	)
}

function GroupName({ name, index }: { name: string; index: number }) {
	return (
		<span className="flex items-center gap-2">
			<span className="h-4 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: tokenomicsGroupColor(index) }} />
			{name}
		</span>
	)
}

function VestingSchedule({ groups }: { groups: Array<UtrDisclosedTokenomicsGroup> }) {
	return (
		<>
			<Panel>
				<PanelHeader>
					<PanelTitle as="h4">Schedule preview</PanelTitle>
				</PanelHeader>
				<div className="grid grid-cols-2 border-b border-subtle">
					<span className="flex flex-col gap-1 px-4 py-3">
						<span className="body-sm text-tertiary">Disclosed Duration</span>
						<span className="label-md">{formatDisclosedMonths(disclosedVestingDurationMonths(groups))}</span>
					</span>
					<span className="flex flex-col gap-1 border-l border-subtle px-4 py-3">
						<span className="body-sm text-tertiary">Disclosed Total Groups</span>
						<span className="label-md">{groups.length}</span>
					</span>
				</div>
				<DisclosedVestingChart
					dataset={disclosedVestingDataset(groups)}
					exportButtons={{ omit: "the Vesting Schedule table below lists every group's terms this chart plots" }}
				/>
			</Panel>
			<h4 className="label-lg">Vesting Schedule</h4>
			<DisclosureTable
				columns={[
					'Group Name',
					'% Unlock at TGE',
					'Lock Up Duration',
					'% Unlock at Init. Cliff',
					'Unlock Duration',
					'Unlock Frequency'
				]}
				rows={groups.map((group, index) => [
					<GroupName key="name" name={group.groupName} index={index} />,
					formatDisclosedPct(group.tgeUnlockPct),
					formatDisclosedMonths(group.lockUpDurationMonths),
					formatDisclosedPct(group.cliffUnlockPct),
					formatDisclosedMonths(group.unlockDurationMonths),
					group.unlockFrequency || 'N/A'
				])}
			/>
		</>
	)
}

function DistributionSchedule({ groups }: { groups: Array<UtrDisclosedTokenomicsGroup> }) {
	return (
		<>
			<h4 className="label-lg">Distribution Schedule</h4>
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
				<div className="w-full shrink-0 lg:w-[200px]">
					<PieChart
						exportButtons={{ omit: "the table beside it lists every group's allocation this pie draws" }}
						chartData={groups.map((group) => ({ name: group.groupName, value: group.allocationPct }))}
						valueSymbol="%"
						radius={['55%', '85%']}
						customLabel={{ show: false }}
						height="200px"
					/>
				</div>
				<div className="min-w-0 flex-1">
					<DisclosureTable
						columns={['Group Name', 'Allocation (% Total Supply)', 'Group Category']}
						rows={groups.map((group, index) => [
							<GroupName key="name" name={group.groupName} index={index} />,
							formatDisclosedPct(group.allocationPct),
							group.groupCategory || 'N/A'
						])}
					/>
				</div>
			</div>
		</>
	)
}

function orNotDisclosed(hasData: boolean, content: ReactNode): ReactNode {
	return hasData ? content : <NotDisclosed />
}

export function DisclosureDetails({
	criterionKey,
	disclosures
}: {
	criterionKey: string
	disclosures: UtrDisclosures
}): ReactNode {
	switch (criterionKey) {
		case 'team_identities':
			return orNotDisclosed(
				disclosures.insiderIdentities.length > 0,
				<DisclosureTable
					columns={['Name', 'Role', 'LinkedIn, GitHub or X Profile', 'Description']}
					rows={disclosures.insiderIdentities.map((row) => [
						row.name,
						row.role || 'N/A',
						<ExternalLink key="profile" href={row.profileUrl} />,
						row.description ?? 'N/A'
					])}
				/>
			)
		case 'roles_org_chart':
			return disclosures.roleDescriptionsCommentary ? (
				<Commentary title="Organization structure and reporting lines" text={disclosures.roleDescriptionsCommentary} />
			) : (
				<NotDisclosed />
			)
		case 'insider_wallets':
			return orNotDisclosed(
				disclosures.insiderWallets.length > 0,
				<DisclosureTable
					columns={['Wallet Address', 'Allocation (% Total Supply)', 'Type of Owner']}
					rows={disclosures.insiderWallets.map((row) => [
						<span key="address" title={row.walletAddress} className="break-all">
							{shortAddress(row.walletAddress)}
						</span>,
						formatAllocation(row.allocationPct),
						row.ownerType || 'N/A'
					])}
				/>
			)
		case 'treasury_reports':
			return disclosures.treasuryReportingCommentary ? (
				<Commentary title="Forgd commentary" text={disclosures.treasuryReportingCommentary} />
			) : (
				<NotDisclosed />
			)
		case 'cash_flows':
			return disclosures.cashFlowCommentary ? (
				<Commentary title="Forgd commentary" text={disclosures.cashFlowCommentary} />
			) : (
				<NotDisclosed />
			)
		case 'legal_entities':
			return orNotDisclosed(
				disclosures.organizationalStructure.length > 0 || disclosures.licenses.length > 0,
				<>
					{disclosures.organizationalStructure.length > 0 ? (
						<DisclosureTable
							columns={['Company Name', 'Jurisdiction', 'Description of Company']}
							rows={disclosures.organizationalStructure.map((row) => [
								row.companyName,
								row.jurisdiction || 'N/A',
								row.description || 'N/A'
							])}
						/>
					) : null}
					{disclosures.licenses.length > 0 ? (
						<DisclosureTable
							columns={['Name of License or Patent', 'Link', 'Description']}
							rows={disclosures.licenses.map((row) => [
								row.name,
								<ExternalLink key="link" href={row.link} />,
								row.description || 'N/A'
							])}
						/>
					) : null}
				</>
			)
		case 'vesting_published':
			return orNotDisclosed(
				disclosures.tokenomicsGroups.length > 0,
				<VestingSchedule groups={disclosures.tokenomicsGroups} />
			)
		case 'distribution_published':
			return orNotDisclosed(
				disclosures.tokenomicsGroups.length > 0,
				<DistributionSchedule groups={disclosures.tokenomicsGroups} />
			)
		case 'external_allocations':
			return orNotDisclosed(
				disclosures.externalAllocations.length > 0,
				<DisclosureTable
					columns={['Counterparty Name', 'Allocation (% Total Supply)', 'Categorization']}
					rows={disclosures.externalAllocations.map((row) => [
						row.counterpartyName,
						formatAllocation(row.allocationPct),
						row.categorization || 'N/A'
					])}
				/>
			)
		case 'multisigs':
			return orNotDisclosed(
				disclosures.multisigWallets.length > 0,
				<DisclosureTable
					columns={['Multisig Wallet', 'Quorum Threshold']}
					rows={disclosures.multisigWallets.map((row) => [
						<span key="address" title={row.walletAddress} className="break-all">
							{shortAddress(row.walletAddress)}
						</span>,
						row.thresholdRequired != null && row.thresholdTotal != null
							? `${row.thresholdRequired} of ${row.thresholdTotal}`
							: 'N/A'
					])}
				/>
			)
		case 'mm_contract_transparency':
			return orNotDisclosed(
				disclosures.marketMakerEngagements.length > 0,
				<>
					<DisclosureTable
						columns={['Market Maker', 'Allocation (% Total Supply)', 'Engagement Type']}
						rows={disclosures.marketMakerEngagements.map((row) => [
							<NamedLogo key="name" name={row.marketMakerName} logoUrl={row.logoUrl} />,
							formatAllocation(row.allocationPct),
							row.engagementType || 'N/A'
						])}
					/>
					{disclosures.verifyMmEngagements != null ? (
						<Card padding="strip" className="flex items-center justify-between gap-3">
							<span className="body-sm text-secondary">
								Willing to verify these engagements through Forgd&apos;s free-to-use Market Maker Monitoring tool
							</span>
							<SecondaryBadge>{disclosures.verifyMmEngagements ? 'Yes' : 'No'}</SecondaryBadge>
						</Card>
					) : null}
				</>
			)
		case 'smart_contract_audits':
			return orNotDisclosed(
				disclosures.auditors.length > 0,
				<DisclosureTable
					columns={['Auditor', 'Type', 'Accessible Link']}
					rows={disclosures.auditors.map((row) => [
						row.name,
						row.type || 'N/A',
						<ExternalLink key="link" href={row.link} />
					])}
				/>
			)
		case 'exchange_agreements':
			return orNotDisclosed(
				disclosures.exchangeEngagements.length > 0,
				<DisclosureTable
					columns={['Exchange', 'Commercial Commitment', 'Additional Commercial Details']}
					rows={disclosures.exchangeEngagements.map((row) => [
						<NamedLogo key="name" name={row.exchangeName} logoUrl={row.logoUrl} />,
						row.commercialCommitment == null ? 'N/A' : row.commercialCommitment ? 'Yes' : 'No',
						row.details ?? 'N/A'
					])}
				/>
			)
		default:
			return null
	}
}
