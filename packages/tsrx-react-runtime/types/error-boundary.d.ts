import { Component, type ReactNode } from 'react';

export interface TsrxErrorBoundaryProps {
	fallback: (error: Error, reset: () => void) => ReactNode;
	children?: ReactNode;
}

export interface TsrxErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

export class TsrxErrorBoundary extends Component<TsrxErrorBoundaryProps, TsrxErrorBoundaryState> {
	static getDerivedStateFromError(error: Error): TsrxErrorBoundaryState;
	render(): ReactNode;
}

export interface TsrxTryBodyProps {
	render: () => ReactNode;
}

export function TsrxTryBody(props: TsrxTryBodyProps): ReactNode;
