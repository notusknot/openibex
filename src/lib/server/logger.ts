import pino from 'pino';
import { getEnv } from '$lib/server/env';

// Single structured logger for the server process. Writes JSON to stdout
// *synchronously* so nothing is lost on a crash or during graceful shutdown
// (pipe through `pino-pretty` in dev if you want colorized output). `redact`
// scrubs common secret-bearing fields so tokens / passwords / cookies never
// reach the logs; Garmin error strings are additionally scrubbed at the call
// site via redactGarminError().
let instance: pino.Logger | null = null;

export function getLogger(): pino.Logger {
	if (instance) return instance;
	instance = pino(
		{
			level: getEnv().LOG_LEVEL,
			base: undefined, // drop pid/hostname noise — single-container app
			serializers: { err: pino.stdSerializers.err },
			redact: {
				paths: [
					'password',
					'*.password',
					'token',
					'*.token',
					'accessToken',
					'refreshToken',
					'access_token',
					'refresh_token',
					'oauth1',
					'oauth2',
					'*.oauth1',
					'*.oauth2',
					'authorization',
					'*.authorization',
					'cookie',
					'*.cookie',
					'encryptedBlob',
					'*.encryptedBlob'
				],
				censor: '[redacted]'
			}
		},
		pino.destination({ sync: true })
	);
	return instance;
}
