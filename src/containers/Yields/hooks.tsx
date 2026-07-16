import { useRouter } from 'next/router'
import { decodeYieldsQuery, type DecodeYieldsQueryContext } from './queryState'

type IFormatYieldQueryParams = DecodeYieldsQueryContext

export const useFormatYieldQueryParams = ({
	projectList,
	chainList,
	categoryList,
	evmChains,
	projectQueryKey = 'project',
	excludeProjectQueryKey = 'excludeProject'
}: IFormatYieldQueryParams) => {
	const router = useRouter()
	return decodeYieldsQuery(router.query, {
		projectList,
		chainList,
		categoryList,
		evmChains,
		projectQueryKey,
		excludeProjectQueryKey
	})
}
