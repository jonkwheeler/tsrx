import { lazy } from 'preact/compat';
import { act } from 'preact/test-utils';
import { useState } from 'preact/hooks';
import { mergeRefs } from '@tsrx/preact/ref';
import { runSwitchFallthroughRuntimeTests } from '@tsrx/core/test-harness/runtime/switch-fallthrough';
import { runTsxExpressionTsrxRuntimeTests } from '@tsrx/core/test-harness/runtime/tsx-expression-tsrx';
import { runJsxTextWhitespaceRuntimeTests } from '@tsrx/core/test-harness/runtime/jsx-text-whitespace';
import { runScriptBodyRuntimeTests } from '@tsrx/core/test-harness/runtime/script-body';
import { runNullishSpreadRefRuntimeTests } from '@tsrx/core/test-harness/runtime/nullish-spread-ref';
import { runExpressionSpreadRefRuntimeTests } from '@tsrx/core/test-harness/runtime/expression-spread-ref';
import { runGeneratorSpreadRefRuntimeTests } from '@tsrx/core/test-harness/runtime/generator-spread-ref';
import { runSpreadRefOrderRuntimeTests } from '@tsrx/core/test-harness/runtime/spread-ref-order';

function text(selector: string): string | null {
	return container.querySelector(selector)?.textContent ?? null;
}

function ResolvedChild(props: { value: string }) {
	return <p class="resolved">{props.value}</p>;
}

function DynamicElementApp() @{
	const tag = 'section';
	<{tag} class="dynamic-host">{'dynamic element'}</{tag}>
}

function DynamicChild(props: { label: string }) @{
	<span class="dynamic-child">{props.label}</span>
}

function DynamicComponentApp() @{
	const component = DynamicChild;
	<{component} label="dynamic component" />
}

function DynamicSwitchApp() @{
	const [tag, setTag] = useState<'section' | 'article'>('section');
	<>
		<{tag} class="dynamic-switch">{tag}</{tag}>
		<button
			class="dynamic-switch-toggle"
			onClick={() => setTag(tag === 'section' ? 'article' : 'section')}
		>
			{'toggle'}
		</button>
	</>
}

function ExplicitHtmlApp() @{
	const [markup, setMarkup] = useState('<span class="html-node">safe enough</span>');
	<>
		<div class="explicit-html-child" dangerouslySetInnerHTML={{ __html: markup }} />
		<button
			class="explicit-html-update"
			onClick={() => {
				setMarkup('<strong class="html-node">updated</strong>');
			}}
		>
			{'update'}
		</button>
	</>
}

function SpreadHtmlApp() @{
	const [spreadProps, setSpreadProps] = useState({
		dangerouslySetInnerHTML: { __html: '<em class="html-node">spread</em>' },
	});
	const [markup, setMarkup] = useState('<span class="html-node">safe enough</span>');
	<>
		<div class="spread-html-child" {...spreadProps} dangerouslySetInnerHTML={{ __html: markup }} />
		<button
			class="spread-html-update-spread"
			onClick={() => {
				setSpreadProps({
					dangerouslySetInnerHTML: { __html: '<i class="html-node">spread update</i>' },
				});
			}}
		>
			{'spread'}
		</button>
		<button
			class="spread-html-update-markup"
			onClick={() => {
				setMarkup('<strong class="html-node">updated</strong>');
			}}
		>
			{'markup'}
		</button>
	</>
}

function EmptyPendingSuspenseApp(props: {
	loader: () => Promise<{ default: typeof ResolvedChild }>;
}) @{
	const LazyChild = lazy(props.loader);
	@try {
		<LazyChild value="hello" />
	} @pending {
	}
}

function ForFilteredApp() @{
	const items = ['a', '', 'c'];
	const visibleItems = items.filter(Boolean);
	@for (const item of visibleItems) {
		<li class="continue-item" key={item}>
			{item}
		</li>
	}
}

function ForOverSetApp() @{
	const items = new Set<string>(['x', 'y', 'z']);
	@for (const item of items) {
		<li class="set-item" key={item}>
			{item}
		</li>
	}
}

function ForOverMapApp() @{
	const entries = new Map<string, number>([
		['a', 1],
		['b', 2],
		['c', 3],
	]);
	@for (const [key, value] of entries) {
		<li class="map-item" {key}>
			{key + ':' + value}
		</li>
	}
}

function ForOverCustomIterableApp() @{
	function* iter() {
		yield 'one';
		yield 'two';
		yield 'three';
	}
	const items = iter();
	@for (const item of items) {
		<li class="generator-item" key={item}>
			{item}
		</li>
	}
}

let named_direct_node: HTMLInputElement | null = null;
let named_direct_native_node: HTMLInputElement | null = null;
let named_direct_anonymous_node: HTMLInputElement | null = null;

function NamedDirectRefApp() @{
	function nativeRef(node: HTMLInputElement | null) {
		named_direct_native_node = node;
	}
	function anonymousRef(node: HTMLInputElement | null) {
		named_direct_anonymous_node = node;
	}
	<input
		ref={mergeRefs(nativeRef, anonymousRef, (node: HTMLInputElement | null) => {
			named_direct_node = node;
		})}
		class="named-direct-ref"
		type="text"
	/>
}

let named_forward_node: HTMLInputElement | null = null;

function NamedForwardInput(props: { type: string; input_ref?: any }) {
	return <input type={props.type} ref={props.input_ref} class="named-forward-ref" />;
}

function NamedForwardRefApp() @{
	<NamedForwardInput
		type="text"
		input_ref={(node: HTMLInputElement | null) => {
			named_forward_node = node;
		}}
	/>
}

let named_spread_before_node: HTMLInputElement | null = null;
let named_spread_before_native_node: HTMLInputElement | null = null;

function namedSpreadBeforeNativeRef(node: HTMLInputElement | null) {
	named_spread_before_native_node = node;
}

function NamedSpreadBeforeRefInput({ input_ref, ...props }: { type: string; input_ref?: any }) @{
	<input
		{...props}
		ref={mergeRefs(input_ref, namedSpreadBeforeNativeRef)}
		class="named-spread-before-ref"
	/>
}

function NamedSpreadBeforeRefApp() @{
	<NamedSpreadBeforeRefInput
		type="text"
		input_ref={(node: HTMLInputElement | null) => {
			named_spread_before_node = node;
		}}
	/>
}

let named_spread_after_node: HTMLInputElement | null = null;
let named_spread_after_native_node: HTMLInputElement | null = null;

function namedSpreadAfterNativeRef(node: HTMLInputElement | null) {
	named_spread_after_native_node = node;
}

function NamedSpreadAfterRefInput({ input_ref, ...props }: { type: string; input_ref?: any }) @{
	<input
		ref={mergeRefs(namedSpreadAfterNativeRef, input_ref)}
		{...props}
		class="named-spread-after-ref"
	/>
}

function NamedSpreadAfterRefApp() @{
	<NamedSpreadAfterRefInput
		type="text"
		input_ref={(node: HTMLInputElement | null) => {
			named_spread_after_node = node;
		}}
	/>
}

let multi_spread_first_node: HTMLInputElement | null = null;
let multi_spread_second_node: HTMLInputElement | null = null;
let multi_spread_native_node: HTMLInputElement | null = null;
let multi_spread_native_calls = 0;

function multiSpreadExplicitNativeRef(node: HTMLInputElement | null) {
	if (node) {
		multi_spread_native_calls += 1;
	}
	multi_spread_native_node = node;
}

function MultiSpreadExplicitRefInput(props: { type: string; first_ref?: any; second_ref?: any }) @{
	const first = { type: props.type, ref: props.first_ref };
	const second = { ref: props.second_ref };
	<input
		{...first}
		{...second}
		ref={multiSpreadExplicitNativeRef}
		class="multi-spread-explicit-ref"
	/>
}

function MultiSpreadExplicitRefApp() @{
	<MultiSpreadExplicitRefInput
		type="text"
		first_ref={(node: HTMLInputElement | null) => {
			multi_spread_first_node = node;
		}}
		second_ref={(node: HTMLInputElement | null) => {
			multi_spread_second_node = node;
		}}
	/>
}

// ── Refs beside a host spread across renders ──

const spread_ref_render_log: string[] = [];

function log_spread_ref(name: string) {
	return (node: HTMLInputElement | null) => {
		spread_ref_render_log.push(`${name}:${node ? 'attach' : 'detach'}`);
	};
}

const own_before_ref = log_spread_ref('own-before');
const own_after_ref = log_spread_ref('own-after');
const own_beside_ref = log_spread_ref('own-beside');
const bag_beside_ref = log_spread_ref('bag-beside');
const swap_first_ref = log_spread_ref('swap-first');
const swap_second_ref = log_spread_ref('swap-second');
const shared_own_ref = log_spread_ref('shared-own');
const plain_bag = { title: 'bag' };
const ref_bag = { title: 'bag', ref: bag_beside_ref };
const shared_bag = { title: 'shared', ref: log_spread_ref('shared-bag') };

function SpreadRefRenderApp() @{
	const [count, setCount] = useState(0);
	const [swapped, setSwapped] = useState(false);
	const [shared, setShared] = useState(true);

	<>
		<input class="own-before" ref={own_before_ref} {...plain_bag} />
		<input class="own-after" {...plain_bag} ref={own_after_ref} />
		<input class="own-beside" ref={own_beside_ref} data-count={count} {...ref_bag} />
		<input
			class="swap"
			ref={swapped ? swap_second_ref : swap_first_ref}
			{...{ 'data-count': count }}
		/>
		<input class="shared" ref={shared_own_ref} {...shared_bag} />
		@if (shared) {
			<input class="shared" ref={shared_own_ref} {...shared_bag} />
		}
		<button class="spread-ref-rerender" onClick={() => setCount(count + 1)}>
			{count}
		</button>
		<button class="spread-ref-swap" onClick={() => setSwapped(true)}>
			{'swap'}
		</button>
		<button class="spread-ref-unshare" onClick={() => setShared(false)}>
			{'unshare'}
		</button>
	</>
}

// ── Conditional host spreads ──

let conditional_spread_and_node: HTMLInputElement | null = null;
let conditional_spread_null_node: HTMLInputElement | null = null;

function ConditionalSpreadApp(props: { enabled: boolean }) @{
	<>
		<input class="conditional-spread" {...(props.enabled && { disabled: true })} />
		<input
			class="conditional-spread"
			ref={(node: HTMLInputElement | null) => {
				conditional_spread_and_node = node;
			}}
			{...(props.enabled && { disabled: true })}
		/>
		<input
			class="conditional-spread"
			ref={(node: HTMLInputElement | null) => {
				conditional_spread_null_node = node;
			}}
			{...(props.enabled ? { disabled: true } : null)}
		/>
	</>
}

const named_ref_object: { current: HTMLInputElement | null } = { current: null };

function NamedRefObjectApp() {
	return <NamedForwardInput type="text" input_ref={named_ref_object} />;
}

function TsrxExpressionHookPanel(props: { active: boolean; label: string }) @{
	const [count, setCount] = useState(0);

	if (!props.active) return null;

	<button class="tsrx-expression-hook-count" onClick={() => setCount(count + 1)}>
		{props.label + ':' + count}
	</button>
}

function TsrxExpressionHookApp() @{
	const [active, setActive] = useState(false);
	const [label, setLabel] = useState('first');
	<>
		<button class="tsrx-expression-hook-toggle" onClick={() => setActive(!active)}>
			{active ? 'hide' : 'show'}
		</button>
		<button class="tsrx-expression-hook-label" onClick={() => setLabel('second')}>
			{'label'}
		</button>
		<TsrxExpressionHookPanel {active} {label} />
	</>
}

type KeyedBranchItem = { id: string; visible: boolean };

function KeyedBranchRow({ item }: { item: KeyedBranchItem }) @{
	const [initial] = useState(item.id);

	<li class="keyed-branch-row">{`${item.id}:${initial}`}</li>
}

function ForKeyedIfApp() @{
	const [items, setItems] = useState<KeyedBranchItem[]>([
		{ id: 'a', visible: true },
		{ id: 'b', visible: true },
	]);

	<>
		<ul>
			@for (const item of items; key item.id) {
				@if (item.visible) {
					<KeyedBranchRow item={item} />
				}
			}
		</ul>
		<button class="reverse-keyed-if" onClick={() => setItems([...items].reverse())}>
			{'reverse'}
		</button>
	</>
}

function ForKeyedSwitchApp() @{
	const [items, setItems] = useState<KeyedBranchItem[]>([
		{ id: 'a', visible: true },
		{ id: 'b', visible: true },
	]);

	<>
		<ul>
			@for (const item of items; key item.id) {
				@switch (item.visible) {
					@case true: {
						<KeyedBranchRow item={item} />
					}
					@default: {
						<li>{'hidden'}</li>
					}
				}
			}
		</ul>
		<button class="reverse-keyed-switch" onClick={() => setItems([...items].reverse())}>
			{'reverse'}
		</button>
	</>
}

describe('@tsrx/vite-plugin-preact runtime', () => {
	it('renders nothing for an empty pending fallback then resolves', async () => {
		let resolve_fn: (mod: { default: typeof ResolvedChild }) => void;
		const loader = () =>
			new Promise<{ default: typeof ResolvedChild }>((r) => {
				resolve_fn = r;
			});

		await render(EmptyPendingSuspenseApp, { loader });
		expect(container.innerHTML).toBe('');
		expect(container.querySelector('.resolved')).toBeNull();

		await act(async () => {
			resolve_fn!({ default: ResolvedChild });
		});
		expect(container.querySelector('.resolved')?.textContent).toBe('hello');
	});

	it('renders dynamic host elements', async () => {
		await render(DynamicElementApp);
		const element = container.querySelector('.dynamic-host');
		expect(element?.tagName).toBe('SECTION');
		expect(element?.textContent).toBe('dynamic element');
	});

	it('renders dynamic components', async () => {
		await render(DynamicComponentApp);
		expect(text('.dynamic-child')).toBe('dynamic component');
	});

	it('updates when the dynamic is prop changes', async () => {
		await render(DynamicSwitchApp);
		let element = container.querySelector('.dynamic-switch');
		expect(element?.tagName).toBe('SECTION');
		expect(element?.textContent).toBe('section');

		await act(async () => {
			(container.querySelector('.dynamic-switch-toggle') as HTMLButtonElement).click();
		});
		element = container.querySelector('.dynamic-switch');
		expect(element?.tagName).toBe('ARTICLE');
		expect(element?.textContent).toBe('article');
	});

	it('renders explicit html interpolation as html', async () => {
		await render(ExplicitHtmlApp);
		expect(text('.explicit-html-child')).toBe('safe enough');
		expect(container.querySelector('.explicit-html-child .html-node')?.tagName).toBe('SPAN');

		await act(async () => {
			(container.querySelector('.explicit-html-update') as HTMLButtonElement).click();
		});
		expect(text('.explicit-html-child')).toBe('updated');
		expect(container.querySelector('.explicit-html-child .html-node')?.tagName).toBe('STRONG');
	});

	it('lets native runtime resolve spread props before explicit html interpolation', async () => {
		await render(SpreadHtmlApp);
		expect(text('.spread-html-child')).toBe('safe enough');
		expect(container.querySelector('.spread-html-child .html-node')?.tagName).toBe('SPAN');

		await act(async () => {
			(container.querySelector('.spread-html-update-spread') as HTMLButtonElement).click();
		});
		expect(text('.spread-html-child')).toBe('safe enough');
		expect(container.querySelector('.spread-html-child .html-node')?.tagName).toBe('SPAN');

		await act(async () => {
			(container.querySelector('.spread-html-update-markup') as HTMLButtonElement).click();
		});
		expect(text('.spread-html-child')).toBe('updated');
		expect(container.querySelector('.spread-html-child .html-node')?.tagName).toBe('STRONG');
	});

	it('renders filtered for-of items', async () => {
		await render(ForFilteredApp);
		expect(
			Array.from(container.querySelectorAll('.continue-item'), (item) => item.textContent),
		).toEqual(['a', 'c']);
	});

	it('renders for-of over a Set via map_iterable', async () => {
		await render(ForOverSetApp);
		expect(Array.from(container.querySelectorAll('.set-item'), (el) => el.textContent)).toEqual([
			'x',
			'y',
			'z',
		]);
	});

	it('renders for-of over a Map via map_iterable', async () => {
		await render(ForOverMapApp);
		expect(Array.from(container.querySelectorAll('.map-item'), (el) => el.textContent)).toEqual([
			'a:1',
			'b:2',
			'c:3',
		]);
	});

	it('renders for-of over a generator/iterator via map_iterable', async () => {
		await render(ForOverCustomIterableApp);
		expect(
			Array.from(container.querySelectorAll('.generator-item'), (el) => el.textContent),
		).toEqual(['one', 'two', 'three']);
	});

	it('merges explicit callback refs with native refs', async () => {
		named_direct_node = null;
		named_direct_native_node = null;
		named_direct_anonymous_node = null;
		await render(NamedDirectRefApp);
		expect(named_direct_node).toBeInstanceOf(HTMLInputElement);
		expect(named_direct_node).toBe(named_direct_native_node);
		expect(named_direct_node).toBe(named_direct_anonymous_node);
		expect(container.querySelector('.named-direct-ref')!.hasAttribute('input_ref')).toBe(false);
	});

	it('supports explicit forwarding of named ref props into host ref', async () => {
		named_forward_node = null;
		await render(NamedForwardRefApp);
		expect(named_forward_node).toBeInstanceOf(HTMLInputElement);
		expect(named_forward_node!.className).toBe('named-forward-ref');
	});

	it('merges explicitly forwarded ref props with native ref after the spread', async () => {
		named_spread_before_node = null;
		named_spread_before_native_node = null;
		await render(NamedSpreadBeforeRefApp);
		expect(named_spread_before_node).toBeInstanceOf(HTMLInputElement);
		expect(named_spread_before_node).toBe(named_spread_before_native_node);
	});

	it('merges explicitly forwarded ref props with native ref before the spread', async () => {
		named_spread_after_node = null;
		named_spread_after_native_node = null;
		await render(NamedSpreadAfterRefApp);
		expect(named_spread_after_node).toBeInstanceOf(HTMLInputElement);
		expect(named_spread_after_node).toBe(named_spread_after_native_node);
	});

	it('merges ref props from multiple host spreads with one explicit ref', async () => {
		multi_spread_first_node = null;
		multi_spread_second_node = null;
		multi_spread_native_node = null;
		multi_spread_native_calls = 0;
		await render(MultiSpreadExplicitRefApp);
		expect(multi_spread_first_node).toBeInstanceOf(HTMLInputElement);
		expect(multi_spread_first_node).toBe(multi_spread_second_node);
		expect(multi_spread_first_node).toBe(multi_spread_native_node);
		expect(multi_spread_native_calls).toBe(1);
		expect(container.querySelector('.multi-spread-explicit-ref')!.hasAttribute('ref')).toBe(false);
	});

	it('applies refs beside a host spread again only when a ref changes', async () => {
		async function click(selector: string) {
			await act(() => {
				(container.querySelector(selector) as HTMLButtonElement).click();
			});
		}

		spread_ref_render_log.length = 0;
		await render(SpreadRefRenderApp);
		expect(spread_ref_render_log).toEqual([
			'own-before:attach',
			'own-after:attach',
			'own-beside:attach',
			'bag-beside:attach',
			'swap-first:attach',
			'shared-own:attach',
			'shared-bag:attach',
			'shared-own:attach',
			'shared-bag:attach',
		]);

		spread_ref_render_log.length = 0;
		await click('.spread-ref-rerender');
		await click('.spread-ref-rerender');
		expect(text('.spread-ref-rerender')).toBe('2');
		expect(container.querySelector('.own-beside')!.getAttribute('data-count')).toBe('2');
		expect(spread_ref_render_log).toEqual([]);

		await click('.spread-ref-swap');
		expect(spread_ref_render_log).toEqual(['swap-first:detach', 'swap-second:attach']);

		// Both `.shared` inputs get the same merged ref; removing one detaches
		// its refs once and leaves the other attached.
		spread_ref_render_log.length = 0;
		await click('.spread-ref-unshare');
		expect(container.querySelectorAll('.shared')).toHaveLength(1);
		expect(spread_ref_render_log).toEqual(['shared-own:detach', 'shared-bag:detach']);
	});

	for (const enabled of [false, true]) {
		it(`renders conditional host spreads when the condition is ${enabled}`, async () => {
			conditional_spread_and_node = null;
			conditional_spread_null_node = null;
			await render(ConditionalSpreadApp, { enabled });
			const inputs = Array.from(
				container.querySelectorAll('.conditional-spread'),
			) as HTMLInputElement[];
			expect(inputs.map((input) => input.disabled)).toEqual([enabled, enabled, enabled]);
			expect(conditional_spread_and_node).toBe(inputs[1]);
			expect(conditional_spread_null_node).toBe(inputs[2]);
		});
	}

	it('assigns named ref props backed by Preact-style ref objects', async () => {
		named_ref_object.current = null;
		await render(NamedRefObjectApp);
		expect(named_ref_object.current).toBeInstanceOf(HTMLInputElement);
		expect(named_ref_object.current!.className).toBe('named-forward-ref');
	});

	it('keeps <> expression hook state stable across regular function rerenders', async () => {
		await render(TsrxExpressionHookApp);
		expect(container.querySelector('.tsrx-expression-hook-count')).toBeNull();

		await act(() => {
			(container.querySelector('.tsrx-expression-hook-toggle') as HTMLButtonElement).click();
		});
		expect(container.querySelector('.tsrx-expression-hook-count')?.textContent).toBe('first:0');

		await act(() => {
			(container.querySelector('.tsrx-expression-hook-count') as HTMLButtonElement).click();
		});
		expect(container.querySelector('.tsrx-expression-hook-count')?.textContent).toBe('first:1');

		await act(() => {
			(container.querySelector('.tsrx-expression-hook-label') as HTMLButtonElement).click();
		});
		expect(container.querySelector('.tsrx-expression-hook-count')?.textContent).toBe('second:1');
	});

	for (const [directive, App, reverse] of [
		['@if', ForKeyedIfApp, '.reverse-keyed-if'],
		['@switch', ForKeyedSwitchApp, '.reverse-keyed-switch'],
	] as const) {
		it(`keeps row state with its item when a keyed loop renders through ${directive}`, async () => {
			const rows = () =>
				Array.from(container.querySelectorAll('.keyed-branch-row'), (row) => row.textContent);

			await render(App);
			expect(rows()).toEqual(['a:a', 'b:b']);

			await act(() => {
				(container.querySelector(reverse) as HTMLButtonElement).click();
			});
			expect(rows()).toEqual(['b:b', 'a:a']);
		});
	}
});

runSwitchFallthroughRuntimeTests();
runTsxExpressionTsrxRuntimeTests();
runJsxTextWhitespaceRuntimeTests({ nbsp: 'trimmed' });
runScriptBodyRuntimeTests();
runNullishSpreadRefRuntimeTests();
runExpressionSpreadRefRuntimeTests();
runGeneratorSpreadRefRuntimeTests();
runSpreadRefOrderRuntimeTests();
