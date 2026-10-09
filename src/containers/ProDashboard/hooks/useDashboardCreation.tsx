import { useMutation, useQueryClient } from '@tanstack/react-query'
import Router from 'next/router'
import { useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { UNIFIED_TABLE_PRESETS_BY_ID } from '~/containers/ProDashboard/components/UnifiedTable/config/PresetRegistry'
import { applyPresetToConfig } from '~/containers/ProDashboard/components/UnifiedTable/utils/configHelpers'
import { dashboardAPI, dashboardUrlKey } from '~/containers/ProDashboard/services/DashboardAPI'
import {
	UNIFIED_TABLE_CONFIG_VERSION,
	type UnifiedTableConfig
} from '~/containers/ProDashboard/unifiedTable/config/current'
import { generateItemId } from '~/containers/ProDashboard/utils/dashboardUtils'

type DatasetType = 'dexs' | 'perps' | 'options' | 'aggregators' | 'bridge-aggregators'

const getDatasetTypeFromPath = (pathname: string): DatasetType | null => {
	if (pathname.includes('/dexs')) return 'dexs'
	if (pathname.includes('/perps')) return 'perps'
	if (pathname.includes('/options')) return 'options'
	if (pathname.includes('/dex-aggregators')) return 'aggregators'
	if (pathname.includes('/bridge-aggregators')) return 'bridge-aggregators'
	return null
}

const getDashboardName = (datasetType: DatasetType): string => {
	const names = {
		dexs: 'DEX Volume Dashboard',
		perps: 'Perp Volume Dashboard',
		options: 'Options Volume Dashboard',
		aggregators: 'Aggregators Dashboard',
		'bridge-aggregators': 'Bridge Aggregators Dashboard'
	} satisfies Readonly<Record<DatasetType, string>>
	return names[datasetType]
}

const PROTOCOL_METRIC_PRESET_BY_DATASET = {
	dexs: 'volume-protocols',
	perps: 'perps-protocols',
	options: 'options-protocols',
	aggregators: 'aggregators-protocols',
	'bridge-aggregators': 'bridge-aggregators-protocols'
} satisfies Readonly<Record<DatasetType, string>>

function createProtocolMetricTable(datasetType: DatasetType): UnifiedTableConfig {
	const presetId = PROTOCOL_METRIC_PRESET_BY_DATASET[datasetType]
	const preset = UNIFIED_TABLE_PRESETS_BY_ID.get(presetId)
	if (!preset) throw new Error(`Missing Unified Table preset: ${presetId}`)
	const config = applyPresetToConfig({ preset, includeRowHeaderRules: true, mergeWithDefaults: true })
	return {
		id: generateItemId('unified-table', datasetType),
		kind: 'unified-table',
		configVersion: UNIFIED_TABLE_CONFIG_VERSION,
		strategy: 'protocols',
		rowHeaders: config.rowHeaders,
		defaultSorting: config.sorting,
		columnOrder: config.columnOrder,
		columnVisibility: config.columnVisibility,
		activePresetId: presetId,
		colSpan: 2
	}
}

export const useDashboardCreation = () => {
	const queryClient = useQueryClient()
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()

	const createMutation = useMutation({
		onMutate: () => toast.loading('Creating dashboard and preparing to redirect…'),
		onSettled: (_data, _error, _variables, loadingToast) => {
			toast.dismiss(loadingToast)
		},
		mutationFn: async (datasetType: DatasetType) => {
			if (!isAuthenticated) {
				throw new Error('Not authenticated')
			}

			const tableItem = createProtocolMetricTable(datasetType)

			const dashboard = await dashboardAPI.createDashboard(
				{
					items: [tableItem],
					dashboardName: getDashboardName(datasetType)
				},
				authorizedFetch
			)

			return dashboard
		},
		// The dashboard exists whether or not the button that made it is still on screen, so the cache
		// write and the toast stay here. The redirect goes on the mutate call below, which React Query
		// drops on unmount, so a reader who navigated away is not pulled back.
		onSuccess: (dashboard) => {
			queryClient.setQueryData(
				['pro-dashboard', 'dashboard', dashboardUrlKey(dashboard), isAuthenticated, user?.id],
				dashboard
			)
			toast.success('Dashboard created successfully')
		},
		onError: (error: unknown) => {
			console.log('Error creating dashboard:', error)
			toast.error(error instanceof Error ? error.message : 'Failed to create dashboard. Please try again.')
		}
	})

	const createDashboardWithDataset = useCallback(() => {
		const datasetType = getDatasetTypeFromPath(Router.pathname)
		if (!datasetType) {
			console.log('Unknown dataset type for path:', Router.pathname)
			toast.error('Unable to determine dataset type for this page')
			return
		}

		if (!isAuthenticated) {
			toast.error('Please sign in to create dashboards')
			return
		}

		createMutation.mutate(datasetType, {
			onSuccess: (dashboard) => {
				void Router.push(`/pro/${dashboardUrlKey(dashboard)}`)
			}
		})
	}, [isAuthenticated, createMutation])

	return {
		createDashboardWithDataset,
		isAuthenticated,
		isLoading: createMutation.isPending
	}
}
