import { defineVaporComponent } from 'vue';

// Props patterns @tsrx/vue reports as TSRX2031, run through vue-jsx-vapor's
// props macro as the compiler would wrap them, and the forms it accepts. An
// explicit `defineVaporComponent` call is not a component TSRX checks, so
// these reach the macro as written.

const DefaultedParam = defineVaporComponent(function ({ s }: { s?: string } = {}) {
	return <p>{String(s)}</p>;
});

const PlainParam = defineVaporComponent(function ({ s }: { s?: string }) {
	return <p>{String(s)}</p>;
});

const NestedRest = defineVaporComponent(function ({
	t: { a, ...r },
}: {
	t: Record<string, number>;
}) {
	return <p>{`${a} ${JSON.stringify(r)}`}</p>;
});

const ArrayRest = defineVaporComponent(function ({ t: [a, ...r] }: { t: number[] }) {
	return <p>{`${a} ${JSON.stringify(r)}`}</p>;
});

const ArrayRestBeforeOwnRest = defineVaporComponent(function ({
	t: [a, ...r],
	...rest
}: {
	t: number[];
	[key: string]: unknown;
}) {
	return <p>{`${a} ${JSON.stringify(r)} ${Object.keys(rest).length}`}</p>;
});

const NestedRestBeforeOwnRest = defineVaporComponent(function ({
	t: { a, ...r },
	...rest
}: {
	t: Record<string, number>;
	[key: string]: unknown;
}) {
	return <p>{`${a} ${JSON.stringify({ ...r })} ${Object.keys(rest).join(',')}`}</p>;
});

describe('vue-jsx-vapor props parameters at runtime', () => {
	it('passes no props to a props parameter with a default', async () => {
		await render(DefaultedParam, { s: 'A' });
		expect(container.textContent).toBe('undefined');
	});

	it('passes props to the same parameter without its default', async () => {
		await render(PlainParam, { s: 'A' });
		expect(container.textContent).toBe('A');
	});

	it("gives a prop's rest element the attrs when it is the last rest", async () => {
		await render(NestedRest, { t: { a: 1, b: 2 }, other: 'x' });
		expect(container.textContent).toBe('1 {"other":"x"}');
	});

	it("gives an array prop's rest element the attrs when it is the last rest", async () => {
		await render(ArrayRest, { t: [1, 2, 3] });
		expect(container.textContent).toBe('1 {}');
	});

	it("gives an array prop's rest element the whole array before the pattern's own rest", async () => {
		await render(ArrayRestBeforeOwnRest, { t: [1, 2, 3] });
		expect(container.textContent).toBe('1 {"0":1,"1":2,"2":3} 0');
	});

	it("reads a prop's rest element followed by the pattern's own rest", async () => {
		await render(NestedRestBeforeOwnRest, { t: { a: 1, b: 2 }, other: 'x' });
		expect(container.textContent).toBe('1 {"b":2} other');
	});
});
