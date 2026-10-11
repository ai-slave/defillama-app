import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useAuthContext } from '~/auth'
import type { ProtocolEmissionResult } from '~/containers/Unlocks/types'
import { handleSimpleFetchResponse } from '~/utils/async'
import { TokenPrivateSectionGate } from './TokenPrivateSectionGate'

const TOKEN_UNLOCKS_SECTION_ID = 'token-unlocks'

const DeferredUnlocksCharts = dynamic(
	() => import('~/containers/Unlocks/EmissionsByProtocol').then((mod) => mod.UnlocksCharts),
	{
		loading: () => <div className="min-h-[572px]" />
	}
)

async function fetchTokenUnlocksClient(
	resolvedUnlocksSlug: string,
	authorizedFetch: (url: string) => Promise<Response | null>
): Promise<ProtocolEmissionResult> {
	const res = await authorizedFetch(`/api/private/token-unlocks/${encodeURIComponent(resolvedUnlocksSlug)}`)
	if (!res) throw new Error('Authentication required')
	return handleSimpleFetchResponse(res).then((response) => response.json() as Promise<ProtocolEmissionResult>)
}

export function TokenUnlocksSection({ resolvedUnlocksSlug }: { resolvedUnlocksSlug?: string | null }) {
	const { authorizedFetch, hasActiveSubscription, isAuthenticated, loaders } = useAuthContext()
	const isEnabled = Boolean(resolvedUnlocksSlug)
	const { data, error, isLoading, dataUpdatedAt } = useQuery<ProtocolEmissionResult>({
		queryKey: ['token-unlocks', resolvedUnlocksSlug],
		queryFn: () => fetchTokenUnlocksClient(resolvedUnlocksSlug!, authorizedFetch),
		staleTime: 60 * 60 * 1000,
		retry: 0,
		refetchOnWindowFocus: false,
		throwOnError: false,
		enabled: isEnabled && isAuthenticated && hasActiveSubscription && !loaders.userLoading
	})

	if (!resolvedUnlocksSlug) {
		return null
	}

	const canReadPrivateSection = isAuthenticated && hasActiveSubscription && !loaders.userLoading
	const unlocksError =
		error ?? (canReadPrivateSection && !isLoading && data == null ? new Error("Couldn't load token unlocks.") : null)

	return (
		<TokenPrivateSectionGate
			title="Unlocks"
			sectionId={TOKEN_UNLOCKS_SECTION_ID}
			contentLabel="token unlocks"
			isLoading={isLoading}
			error={unlocksError}
			errorMessage="Couldn't load token unlocks."
			bodyClassName="flex flex-col gap-2 p-2"
		>
			{data ? (
				<DeferredUnlocksCharts
					protocolName={resolvedUnlocksSlug}
					initialData={data}
					generatedAtSec={Math.floor(dataUpdatedAt / 1000)}
					disableClientTokenStatsFetch
					hideTokenStats
					isEmissionsPage={false}
				/>
			) : null}
		</TokenPrivateSectionGate>
	)
}
