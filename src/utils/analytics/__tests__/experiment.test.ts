// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AB_SEED_COOKIE_NAME, getABGroup } from '~/utils/abTesting'
import { getHeadBootstrapScript } from '~/utils/cookies'
import {
	EXPERIMENTS,
	getExperimentAttribute,
	getVariant,
	trackExperimentAction,
	trackExperimentExposure,
	VISITOR_EXPERIMENT_IDS,
	type ExperimentId
} from '../experiment'

const seeds = Array.from({ length: 64 }, (_, i) => `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`)

describe('experiment split', () => {
	test('each experiment splits on its own, not on the global cookie group or another experiment', () => {
		const groupB = seeds.filter((seed) => getABGroup(seed) === 'b')
		expect(new Set(groupB.map((seed) => getVariant('home-brief-default-v1', seed)))).toEqual(new Set(['a', 'b']))
		expect(
			seeds.some((seed) => getVariant('home-brief-default-v1', seed) !== getVariant('llamaai-free-label-v1', seed))
		).toBe(true)
	})

	test('the pre-paint attribute shows the same variant the page reports as exposed', () => {
		for (const seed of seeds.slice(0, 8)) {
			document.cookie = `${AB_SEED_COOKIE_NAME}=${seed}`
			new Function(getHeadBootstrapScript())()
			for (const id of VISITOR_EXPERIMENT_IDS) {
				expect(document.documentElement.getAttribute(getExperimentAttribute(id))).toBe(getVariant(id, seed))
			}
		}
	})

	test('experiment ids fit the id pattern the analytics rollup accepts', () => {
		for (const id of Object.keys(EXPERIMENTS)) expect(id).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/)
	})
})

describe('experiment events', () => {
	afterEach(() => {
		sessionStorage.clear()
		delete window.umami
	})

	test('exposure is sent once per session per experiment, with the names the rollup reads', () => {
		const track = vi.fn()
		window.umami = { track } as unknown as typeof window.umami
		const id: ExperimentId = 'home-brief-default-v1'
		trackExperimentExposure(id, 'b')
		trackExperimentExposure(id, 'b')
		trackExperimentAction(id, 'b', 'brief-open')
		expect(track.mock.calls).toEqual([
			['experiment-exposure', { experiment: id, variant: 'b' }],
			['experiment-action', { experiment: id, variant: 'b', metric: 'brief-open' }]
		])
	})
})
