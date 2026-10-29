import type { Rule } from 'eslint';
import { get_core_rule, merge_listeners, wrapper_meta } from '../utils/core-rule.js';

const core = get_core_rule('no-unreachable');

const FUNCTION_TYPES = new Set([
	'FunctionDeclaration',
	'FunctionExpression',
	'ArrowFunctionExpression',
]);

/** The statements an unlabeled `break` leaves. */
const BREAKABLE_TYPES = [
	'WhileStatement',
	'DoWhileStatement',
	'ForStatement',
	'ForInStatement',
	'ForOfStatement',
	'SwitchStatement',
];

const SEGMENT_EVENTS = [
	'onCodePathSegmentStart',
	'onUnreachableCodePathSegmentStart',
	'onCodePathSegmentEnd',
	'onUnreachableCodePathSegmentEnd',
] as const;

/** The fields of a code path segment this rule reads. */
interface Segment {
	reachable: boolean;
	allPrevSegments: Segment[];
}

interface SwitchState {
	/** Whether the `@switch` is reached. */
	entry: boolean;
	has_default: boolean;
	/** Whether some arm reaches its end. */
	completes: boolean;
}

/**
 * Core `no-unreachable`, with the arms of a `@switch` as alternatives.
 *
 * ESLint's code path analysis knows only the standard node types, so it runs
 * the arms of a `@switch` one after another: after an arm that throws, it
 * marks the other arms and the code after the `@switch` unreachable. The core
 * rule here sees each segment through a proxy whose `reachable` revives those
 * paths: at the start of each arm of a reached `@switch`, and after the
 * `@switch` when an arm reaches its end or there is no `@default` arm.
 *
 * Code path analysis records no exit inside code it already holds
 * unreachable, so in a revived path this rule tracks `throw` and `return`
 * itself: the code after one is unreachable again, until a `catch` or
 * `finally` block of a reached `try`, the next arm, or a path from elsewhere.
 * A `break` there revives the code after the statement it leaves. The code
 * right after a `break` or `continue` in a revived path isn't reported.
 */
const rule: Rule.RuleModule = {
	meta: wrapper_meta(
		core,
		'Disallow unreachable code after `return`, `throw`, `continue`, and `break` statements, with the arms of a `@switch` as alternatives',
	),
	create(context) {
		const listeners = core.create(context) as Record<string, any>;

		// Revived segments, and segments an exit in a revived path ended. Both
		// change as the traversal goes on: a segment can span several arms.
		const revived = new WeakSet<Segment>();
		const exited = new WeakSet<Segment>();

		const outer_segments: Set<Segment>[] = [];
		let current = new Set<Segment>();
		const switches = new Map<unknown, SwitchState>();
		const try_entries = new Map<unknown, boolean>();
		// Statements a `break` in a revived path leaves.
		const broken = new WeakSet<object>();
		const proxies = new WeakMap<Segment, { readonly reachable: boolean }>();

		function is_reachable(segment: Segment, seen = new Set<Segment>()): boolean {
			if (segment.reachable || revived.has(segment)) return true;
			if (exited.has(segment) || seen.has(segment)) return false;
			seen.add(segment);
			const previous = segment.allPrevSegments;
			// Code path analysis made it unreachable after an exit.
			if (previous.some((segment) => segment.reachable)) return false;
			return previous.some((segment) => is_reachable(segment, seen));
		}

		const any_reachable = () => [...current].some((segment) => is_reachable(segment));

		const revive = () => {
			for (const segment of current) {
				exited.delete(segment);
				revived.add(segment);
			}
		};

		const proxy = (segment: Segment) => {
			let result = proxies.get(segment);
			if (!result) {
				result = {
					get reachable() {
						return is_reachable(segment);
					},
				};
				proxies.set(segment, result);
			}
			return result;
		};

		const wrapped: Record<string, (...args: any[]) => void> = {
			onCodePathStart(...args: any[]) {
				outer_segments.push(current);
				current = new Set();
				listeners.onCodePathStart?.(...args);
			},
			onCodePathEnd(...args: any[]) {
				current = outer_segments.pop()!;
				listeners.onCodePathEnd?.(...args);
			},
		};
		for (const event of SEGMENT_EVENTS) {
			const starts = event.endsWith('Start');
			wrapped[event] = (segment: Segment, node: Rule.Node) => {
				if (starts) current.add(segment);
				else current.delete(segment);
				listeners[event]?.(proxy(segment), node);
			};
		}

		// Before the core rule checks the block.
		wrapped.BlockStatement = (node: any) => {
			const parent = node.parent;
			if (
				parent.type === 'TryStatement' &&
				parent.finalizer === node &&
				try_entries.get(parent) &&
				!any_reachable()
			) {
				revive();
			}
			listeners.BlockStatement(node);
		};

		const exit = () => {
			for (const segment of current) {
				if (segment.reachable) continue;
				revived.delete(segment);
				exited.add(segment);
			}
		};

		const revive_after_break = (node: object) => {
			if (broken.has(node) && !any_reachable()) revive();
		};

		return merge_listeners(
			{ ...listeners, ...wrapped },
			{
				...Object.fromEntries(
					[...BREAKABLE_TYPES, 'LabeledStatement'].map((type) => [
						`${type}:exit`,
						revive_after_break,
					]),
				),
				'BreakStatement:exit'(node: any) {
					if (![...current].some((segment) => !segment.reachable && is_reachable(segment))) {
						return;
					}
					const target = break_target(node);
					if (target) broken.add(target);
				},
				'ThrowStatement:exit': exit,
				'ReturnStatement:exit': exit,
				TryStatement(node: unknown) {
					try_entries.set(node, any_reachable());
				},
				CatchClause(node: any) {
					if (try_entries.get(node.parent) && !any_reachable()) revive();
				},
				JSXSwitchExpression(node: any) {
					switches.set(node, {
						entry: any_reachable(),
						has_default: node.cases.some((switch_case: any) => !switch_case.test),
						completes: false,
					});
				},
				JSXSwitchCase(node: any) {
					if (switches.get(node.parent)!.entry && !any_reachable()) revive();
				},
				'JSXSwitchCase:exit'(node: any) {
					const state = switches.get(node.parent)!;
					state.completes ||= any_reachable();
				},
				'JSXSwitchExpression:exit'(node: any) {
					const state = switches.get(node)!;
					if (state.entry && (state.completes || !state.has_default) && !any_reachable()) {
						revive();
					}
				},
			},
		);
	},
};

function break_target(node: any): object | null {
	for (
		let parent = node.parent;
		parent && !FUNCTION_TYPES.has(parent.type);
		parent = parent.parent
	) {
		if (
			node.label
				? parent.type === 'LabeledStatement' && parent.label.name === node.label.name
				: BREAKABLE_TYPES.includes(parent.type)
		) {
			return parent;
		}
	}
	return null;
}

export default rule;
