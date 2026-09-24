import { fetchRWAPlatformAumChart, fetchRWAProtocolMcapChart } from '~/containers/RWA/api'

export function fetchProtocolRwaAumChart({
	rwaProtocolMcapSlug,
	rwaPlatformSlug
}: {
	rwaProtocolMcapSlug: string | null
	rwaPlatformSlug: string | null
}): Promise<Array<[number, number]>> {
	// A child's issued assets take precedence over the whole parent platform.
	if (rwaProtocolMcapSlug) return fetchRWAProtocolMcapChart(rwaProtocolMcapSlug)
	if (rwaPlatformSlug) return fetchRWAPlatformAumChart(rwaPlatformSlug)
	return Promise.resolve([])
}
