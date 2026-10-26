import type { IterationValue } from '@tsrx/runtime/iterable';

type Missing = null | undefined | false;

export function for_items<I extends Iterable<unknown> | Iterator<unknown> | Missing>(
	source: I,
): I extends Missing ? I : IterationValue<I>[];
