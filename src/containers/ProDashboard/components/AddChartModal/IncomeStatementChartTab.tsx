import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { IncomeStatement } from '~/containers/ProtocolOverview/IncomeStatement'
import { getProtocolIncomeStatement } from '~/containers/ProtocolOverview/queries'
import { Icon } from '~/ui/Icon'
import { LocalLoader } from '~/ui/Loaders'
import { useAppMetadata } from '../../AppMetadataContext'
import { AriakitVirtualizedSelect, type VirtualizedSelectOption } from '../AriakitVirtualizedSelect'
import { BoundParameterChip, useModalFieldBinding } from './bindingContext'

interface IncomeStatementChartTabProps {
	selectedIncomeStatementProtocol: string | null
	selectedIncomeStatementProtocolName: string | null
	onSelectedIncomeStatementProtocolChange: (protocol: string | null) => void
	onSelectedIncomeStatementProtocolNameChange: (name: string | null) => void
	protocolOptions: Array<VirtualizedSelectOption>
	protocolsLoading: boolean
}

export function IncomeStatementChartTab({
	selectedIncomeStatementProtocol,
	selectedIncomeStatementProtocolName,
	onSelectedIncomeStatementProtocolChange,
	onSelectedIncomeStatementProtocolNameChange,
	protocolOptions,
	protocolsLoading
}: IncomeStatementChartTabProps) {
	const { protocolsBySlug } = useAppMetadata()

	const filteredProtocolOptions = useMemo(() => {
		return protocolOptions.filter((option) => {
			const record = protocolsBySlug.get(option.value) ?? protocolsBySlug.get(option.value.toLowerCase())
			return Boolean(record?.flags?.fees && record?.flags?.revenue)
		})
	}, [protocolOptions, protocolsBySlug])

	const selectedRecord = selectedIncomeStatementProtocol
		? (protocolsBySlug.get(selectedIncomeStatementProtocol) ??
			protocolsBySlug.get(selectedIncomeStatementProtocol.toLowerCase()) ??
			null)
		: null
	const displayName =
		selectedRecord?.displayName || selectedIncomeStatementProtocolName || selectedIncomeStatementProtocol || ''

	const metadata = useMemo(
		() => ({
			displayName,
			fees: Boolean(selectedRecord?.flags?.fees),
			revenue: Boolean(selectedRecord?.flags?.revenue),
			incentives: Boolean(selectedRecord?.flags?.incentives),
			emissions: Boolean(selectedRecord?.flags?.emissions)
		}),
		[
			displayName,
			selectedRecord?.flags?.fees,
			selectedRecord?.flags?.revenue,
			selectedRecord?.flags?.incentives,
			selectedRecord?.flags?.emissions
		]
	)

	const { data: incomeStatement, isLoading } = useQuery({
		queryKey: ['pro-dashboard', 'income-statement-preview', selectedIncomeStatementProtocol],
		queryFn: () => getProtocolIncomeStatement({ metadata }),
		enabled: Boolean(selectedIncomeStatementProtocol && displayName),
		staleTime: 60 * 60 * 1000
	})

	const hasData = useMemo(() => {
		if (!incomeStatement?.data) return false
		return (['monthly', 'quarterly', 'yearly'] as const).some(
			(key) => Object.keys(incomeStatement.data[key] ?? {}).length > 0
		)
	}, [incomeStatement])

	const protocolParameter = useModalFieldBinding('protocol', 'protocol')
	const selectableProtocolOptions = useMemo(
		() =>
			protocolParameter.options.length > 0
				? [...protocolParameter.options, ...filteredProtocolOptions]
				: filteredProtocolOptions,
		[protocolParameter.options, filteredProtocolOptions]
	)

	const hasIncentives = Boolean(selectedRecord?.flags?.incentives || selectedRecord?.flags?.emissions)
	const hasSelection = Boolean(selectedIncomeStatementProtocol)

	return (
		<div className="flex flex-col gap-4">
			<div className="space-y-3">
				{protocolParameter.boundVariable ? (
					<BoundParameterChip label={protocolParameter.boundVariable.label} onUnbind={protocolParameter.unbind} />
				) : null}
				<AriakitVirtualizedSelect
					label="Protocol"
					options={selectableProtocolOptions}
					selectedValue={selectedIncomeStatementProtocol || ''}
					onChange={(option) => {
						const variable = protocolParameter.resolveSelection(option.value)
						if (variable) {
							onSelectedIncomeStatementProtocolChange(variable.value)
							onSelectedIncomeStatementProtocolNameChange(
								filteredProtocolOptions.find((item) => item.value === variable.value)?.label ?? variable.value
							)
							protocolParameter.bind(variable.id)
							return
						}
						onSelectedIncomeStatementProtocolChange(option.value)
						onSelectedIncomeStatementProtocolNameChange(option.label)
					}}
					placeholder="Select protocol..."
					isLoading={protocolsLoading}
				/>
				{!protocolsLoading && filteredProtocolOptions.length === 0 ? (
					<p className="text-xs text-pro-text-tertiary">No protocols with both fees and revenue.</p>
				) : null}
			</div>

			<div className="overflow-hidden rounded-lg border border-pro-cards-border">
				<h4 className="border-b border-pro-cards-border px-3 py-2 text-xs font-medium text-pro-text-secondary">
					Preview
				</h4>
				{hasSelection ? (
					<div className="bg-pro-cards-bg p-3">
						{isLoading ? (
							<div className="flex h-[360px] items-center justify-center">
								<LocalLoader />
							</div>
						) : !incomeStatement || !hasData ? (
							<div className="flex h-[360px] items-center justify-center text-center text-pro-text-tertiary">
								No income statement data available.
							</div>
						) : (
							<div>
								<IncomeStatement
									name={displayName || selectedIncomeStatementProtocolName || selectedIncomeStatementProtocol || ''}
									incomeStatement={incomeStatement}
									hasIncentives={hasIncentives}
									view="sankey"
									anchorId={`income-statement-preview-${selectedIncomeStatementProtocol}`}
									className="border-none bg-transparent p-0"
								/>
							</div>
						)}
					</div>
				) : (
					<div className="flex h-[360px] items-center justify-center text-center text-pro-text-tertiary">
						<div>
							<Icon name="file-text" height={32} width={32} className="mx-auto mb-1" />
							<p className="text-xs">Select a protocol to preview the income statement</p>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
