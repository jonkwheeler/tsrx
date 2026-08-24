import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow lazy destructuring (&[] / &{}) in TypeScript/JavaScript modules',
			recommended: true,
		},
		messages: {
			noLazyDestructuring:
				'Lazy destructuring (&[] / &{}) is TSRX syntax and cannot be used in TypeScript/JavaScript modules.',
		},
		schema: [],
	},
	create(context) {
		const filename = context.filename;

		// Skip TSRX files where lazy destructuring is valid
		if (filename && filename.endsWith('.tsrx')) {
			return {};
		}

		return {
			ArrayPattern(node: any) {
				if (node.lazy === true) {
					context.report({
						node,
						messageId: 'noLazyDestructuring',
					});
				}
			},
			ObjectPattern(node: any) {
				if (node.lazy === true) {
					context.report({
						node,
						messageId: 'noLazyDestructuring',
					});
				}
			},
		};
	},
};

export default rule;
