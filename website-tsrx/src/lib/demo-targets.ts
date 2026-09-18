export const DEMO_TARGET_OPTIONS = [
	{ value: 'hono', label: 'Hono (server)', outputLabel: 'Hono server output' },
	{ value: 'hono-dom', label: 'Hono (DOM)', outputLabel: 'Hono DOM output' },
	{ value: 'octane', label: 'Octane', outputLabel: 'Octane output' },
	{ value: 'react', label: 'React', outputLabel: 'React output' },
	{ value: 'preact', label: 'Preact', outputLabel: 'Preact output' },
	{ value: 'ripple', label: 'Ripple', outputLabel: 'Ripple output' },
	{ value: 'solid', label: 'Solid', outputLabel: 'Solid output' },
	{ value: 'vue', label: 'Vue', outputLabel: 'Vue output' },
] as const;

export const DEMO_TARGET_VALUES = DEMO_TARGET_OPTIONS.map((target) => target.value);
export type DemoTarget = (typeof DEMO_TARGET_VALUES)[number];
