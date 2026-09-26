import { useRouter } from 'next/router'
import { decodeYieldsQuery, type DecodeYieldsQueryContext } from './queryState'

export const useFormatYieldQueryParams = (context: DecodeYieldsQueryContext) => {
	const router = useRouter()
	return decodeYieldsQuery(router.query, context)
}
