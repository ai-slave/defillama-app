import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCexs } from '../api'
import { getCexsPageData } from '../queries'

vi.mock('../api', () => ({ fetchCexs: vi.fn() }))

describe('CEX page data', () => {
	beforeEach(() => vi.resetAllMocks())

	it('names the legacy reserves identifier explicitly at the frontend boundary', async () => {
		vi.mocked(fetchCexs).mockResolvedValue({
			cexs: [{ name: 'Binance', slug: 'binance-cex' }],
			cg_volume_cexs: []
		})

		const { cexs } = await getCexsPageData()

		expect(cexs[0]).toMatchObject({ name: 'Binance', defillamaCexSlug: 'binance-cex' })
		expect(cexs[0]).not.toHaveProperty('slug')
	})
})
