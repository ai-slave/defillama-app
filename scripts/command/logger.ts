import fs from 'node:fs'
import path from 'node:path'
import { createSecretRedactor } from './redaction'

export type LogLike = {
	log: (...args: Array<unknown>) => void
}

export type CommandLogger = LogLike & {
	close: () => void
	flush: () => void
	flushOutput: () => void
	stderr: (chunk: Buffer | string) => void
	stdout: (chunk: Buffer | string) => void
}

type TeeLoggerOptions = {
	logPath: string
	redactor?: (text: string) => string
	stderr?: NodeJS.WriteStream
	stdout?: NodeJS.WriteStream
}

type BufferedOutput = {
	flush: () => void
	write: (stream: NodeJS.WriteStream, chunk: Buffer | string) => void
}

const MAX_UNTERMINATED_OUTPUT_LENGTH = 64 * 1024
const TRUNCATED_OUTPUT_MESSAGE = '[output truncated: unterminated line exceeded 64 KiB]\n'

function createFileOperationError(operation: string, target: string, error: unknown): Error {
	return new Error(`Failed to ${operation} for ${target}: ${error instanceof Error ? error.message : String(error)}`, {
		cause: error
	})
}

export function createTeeLogger({
	logPath,
	redactor = createSecretRedactor(),
	stderr = process.stderr,
	stdout = process.stdout
}: TeeLoggerOptions): CommandLogger {
	fs.mkdirSync(path.dirname(logPath), { recursive: true })
	let fd: number
	try {
		fd = fs.openSync(logPath, 'w')
	} catch (error) {
		throw createFileOperationError('open build log', logPath, error)
	}
	let closed = false

	const writeFile = (chunk: string) => {
		if (!closed) {
			try {
				fs.writeSync(fd, chunk)
			} catch (error) {
				throw createFileOperationError('write build log', logPath, error)
			}
		}
	}
	const createBufferedOutput = (): BufferedOutput => {
		let discardingLongLine = false
		let pending = ''
		let pendingStream: NodeJS.WriteStream | null = null

		const emit = (text: string) => {
			const redactedChunk = redactor(text)
			const stream = pendingStream ?? stdout
			stream.write(redactedChunk)
			writeFile(redactedChunk)
		}

		return {
			flush() {
				if (!pending) return
				emit(pending)
				pending = ''
				pendingStream = null
			},
			write(stream, chunk) {
				let text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
				if (discardingLongLine) {
					const lineEnd = text.search(/[\r\n]/)
					if (lineEnd === -1) return
					discardingLongLine = false
					text = text.slice(lineEnd + 1)
				}
				if (!text) return

				pendingStream ??= stream
				pending += text
				const lineEnd = Math.max(pending.lastIndexOf('\n'), pending.lastIndexOf('\r'))
				if (lineEnd !== -1) {
					emit(pending.slice(0, lineEnd + 1))
					pending = pending.slice(lineEnd + 1)
					pendingStream = pending ? stream : null
				}

				if (pending.length > MAX_UNTERMINATED_OUTPUT_LENGTH) {
					pending = ''
					discardingLongLine = true
					emit(TRUNCATED_OUTPUT_MESSAGE)
					pendingStream = null
				}
			}
		}
	}
	const bufferedOutput = createBufferedOutput()
	const flushBufferedOutput = () => bufferedOutput.flush()

	return {
		close() {
			if (!closed) {
				let closeError: Error | undefined
				try {
					flushBufferedOutput()
				} catch (error) {
					closeError = error instanceof Error ? error : new Error(String(error), { cause: error })
				}
				try {
					fs.closeSync(fd)
				} catch (error) {
					closeError ??= createFileOperationError('close build log', `fd ${fd} (${logPath})`, error)
				} finally {
					closed = true
				}
				if (closeError) {
					throw new Error(closeError.message, { cause: closeError })
				}
			}
		},
		flush() {
			if (!closed) {
				flushBufferedOutput()
				try {
					fs.fsyncSync(fd)
				} catch (error) {
					throw createFileOperationError('flush build log', `fd ${fd} (${logPath})`, error)
				}
			}
		},
		flushOutput: flushBufferedOutput,
		log(...args) {
			bufferedOutput.write(stdout, formatLogLine(args))
		},
		stderr(chunk) {
			bufferedOutput.write(stderr, chunk)
		},
		stdout(chunk) {
			bufferedOutput.write(stdout, chunk)
		}
	}
}

function formatLogArg(arg: unknown): string {
	return arg instanceof Error ? (arg.stack ?? arg.message) : String(arg)
}

function formatLogLine(args: Array<unknown>): string {
	return `${args.map(formatLogArg).join(' ')}\n`
}

export function createRedactedConsoleLogger(env: NodeJS.ProcessEnv = process.env): LogLike {
	const redactor = createSecretRedactor(env)
	return {
		log(...args) {
			console.log(...args.map((arg) => redactor(formatLogArg(arg))))
		}
	}
}

export function createMemoryLogger(): CommandLogger & { output: Array<string> } {
	const output: Array<string> = []
	const write = (chunk: Buffer | string) => {
		output.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
	}

	return {
		close() {},
		flush() {},
		flushOutput() {},
		log(...args) {
			write(formatLogLine(args))
		},
		output,
		stderr: write,
		stdout: write
	}
}
