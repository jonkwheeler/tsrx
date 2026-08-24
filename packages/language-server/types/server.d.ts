export interface TsrxLanguageServer {
	connection: unknown;
	server: unknown;
}

export function createTsrxLanguageServer(): TsrxLanguageServer;

/** @deprecated Use `createTsrxLanguageServer`. */
export const createRippleLanguageServer: typeof createTsrxLanguageServer;
