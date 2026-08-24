import { createTsrxLanguageServer } from '@tsrx/language-server/server';

try {
	createTsrxLanguageServer();
} catch (error) {
	console.error('[TSRX Server] Failed to start:', error);
	process.exit(1);
}
