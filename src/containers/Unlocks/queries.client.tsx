import { useQuery } from '@tanstack/react-query'
import { slug } from '~/utils'
import { getProtocolEmissions } from './queries'

export const useGetProtocolEmissions = (protocol?: string | null) => {
	const isEnabled = !!protocol
	return useQuery({
		queryKey: ['unlocks', 'emissions', protocol, isEnabled],
		queryFn: isEnabled ? () => getProtocolEmissions(slug(protocol)) : () => Promise.resolve(null),
		staleTime: 60 * 60 * 1000,
		retry: 0,
		enabled: isEnabled
	})
}
