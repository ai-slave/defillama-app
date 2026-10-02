import { useEffect } from 'react'
import { useAuthContext } from '~/auth'
import { useIsClient } from '~/hooks/useIsClient'
import {
	readExperimentVariant,
	trackExperimentAction,
	trackExperimentExposure,
	type ExperimentId
} from '~/utils/analytics/experiment'

const EXPERIMENT_ID: ExperimentId = 'llamaai-free-label-v1'

export const freeLabelAOnly = '[html[data-ab-llamaai-free-label-v1=b]_&]:hidden'
export const freeLabelBOnly = 'hidden [html[data-ab-llamaai-free-label-v1=b]_&]:inline'
export const freeBadgeBOnly =
	'hidden shrink-0 items-center rounded-full border border-medium bg-surface-elevated-1 px-2 py-0.5 label-xs tracking-wide text-warning [html[data-ab-llamaai-free-label-v1=b]_&]:inline-flex'

export function useLlamaAIFreeLabel(enabled = true) {
	const isClient = useIsClient()
	const { hasActiveSubscription, loaders } = useAuthContext()
	const eligible = enabled && !loaders.userLoading && !hasActiveSubscription

	useEffect(() => {
		if (!eligible) return
		const variant = readExperimentVariant(EXPERIMENT_ID)
		if (variant) trackExperimentExposure(EXPERIMENT_ID, variant)
	}, [eligible])

	return {
		showFree: !(isClient && hasActiveSubscription),
		trackEntryClick: () => {
			const variant = eligible ? readExperimentVariant(EXPERIMENT_ID) : null
			if (variant) trackExperimentAction(EXPERIMENT_ID, variant, 'entry-click')
		}
	}
}
