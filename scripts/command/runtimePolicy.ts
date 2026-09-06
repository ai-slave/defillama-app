export const NODE_RUNTIME_MAJOR = 24

type RuntimePolicyViolation = {
	filePath: string
	message: string
	patternId: string
}

function isStandaloneRuntimeLauncher(filePath: string): boolean {
	return (
		filePath === 'Dockerfile' ||
		filePath.endsWith('/Dockerfile') ||
		filePath.endsWith('docker-entrypoint.sh') ||
		filePath.endsWith('standalone.sh')
	)
}

export const FORBIDDEN_RUNTIME_INVOCATIONS = [
	{
		id: 'next-start-standalone-runtime',
		message: 'Use standalone server.js on Node instead of next start in Docker or standalone launchers.',
		pattern: /\bnext\s+start\b/,
		appliesTo: isStandaloneRuntimeLauncher
	}
] as const

export function findRuntimePolicyViolations(
	files: Array<{ content: string; filePath: string }>
): Array<RuntimePolicyViolation> {
	const violations: Array<RuntimePolicyViolation> = []

	for (const file of files) {
		for (const forbidden of FORBIDDEN_RUNTIME_INVOCATIONS) {
			if ('appliesTo' in forbidden && !forbidden.appliesTo(file.filePath)) continue
			if (forbidden.pattern.test(file.content)) {
				violations.push({
					filePath: file.filePath,
					message: forbidden.message,
					patternId: forbidden.id
				})
			}
		}
	}

	return violations
}
