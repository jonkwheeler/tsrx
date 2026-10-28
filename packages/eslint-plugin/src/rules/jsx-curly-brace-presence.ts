/**
 * `react/jsx-curly-brace-presence` for TSRX text.
 *
 * Copied from eslint-plugin-react 7.37.5 (`lib/rules/jsx-curly-brace-presence.js`,
 * MIT license, Copyright © 2014 Yannick Croissant), with the same options and
 * messages. Apart from types and calling ESLint's API directly, the only
 * changes, marked `TSRX:`, keep the braces around a string child that TSRX text
 * reads differently than JSX text does: a directive (`@if (`, `@for (`, ...), a
 * `//` or `/*` comment, or the CSS of a `<style>` element. Keep the rest in step
 * with eslint-plugin-react when upgrading.
 */
import type { Rule } from 'eslint';

type AnyNode = Record<string, any>;

const OPTION_ALWAYS = 'always';
const OPTION_NEVER = 'never';
const OPTION_IGNORE = 'ignore';

const OPTION_VALUES = [OPTION_ALWAYS, OPTION_NEVER, OPTION_IGNORE];
const DEFAULT_CONFIG = {
	props: OPTION_NEVER,
	children: OPTION_NEVER,
	propElementValues: OPTION_IGNORE,
};

const HTML_ENTITY_REGEX = () => /&[A-Za-z\d#]+;/g;

function containsLineTerminators(rawStringValue: string) {
	return /[\n\r\u2028\u2029]/.test(rawStringValue);
}

function containsBackslash(rawStringValue: string) {
	return rawStringValue.includes('\\');
}

function containsHTMLEntity(rawStringValue: string) {
	return HTML_ENTITY_REGEX().test(rawStringValue);
}

function containsOnlyHtmlEntities(rawStringValue: string) {
	return rawStringValue.replace(HTML_ENTITY_REGEX(), '').trim() === '';
}

function containsDisallowedJSXTextChars(rawStringValue: string) {
	return /[{<>}]/.test(rawStringValue);
}

function containsQuoteCharacters(value: string) {
	return /['"]/.test(value);
}

function containsMultilineComment(value: string) {
	return /\/\*/.test(value);
}

function escapeDoubleQuotes(rawStringValue: string) {
	return rawStringValue.replace(/\\"/g, '"').replace(/"/g, '\\"');
}

function escapeBackslashes(rawStringValue: string) {
	return rawStringValue.replace(/\\/g, '\\\\');
}

function needToEscapeCharacterForJSX(raw: string, node: AnyNode) {
	return (
		containsBackslash(raw) ||
		containsHTMLEntity(raw) ||
		(node.parent.type !== 'JSXAttribute' && containsDisallowedJSXTextChars(raw))
	);
}

function isJSX(node: AnyNode | null | undefined) {
	return !!node && (node.type === 'JSXElement' || node.type === 'JSXFragment');
}

function isWhiteSpaces(value: unknown) {
	return typeof value === 'string' ? /^\s*$/.test(value) : false;
}

function containsWhitespaceExpression(child: AnyNode) {
	if (child.type === 'JSXExpressionContainer') {
		const value = child.expression.value;
		return value ? isWhiteSpaces(value) : false;
	}
	return false;
}

function isLineBreak(text: string) {
	return containsLineTerminators(text) && text.trim() === '';
}

function wrapNonHTMLEntities(text: string) {
	const HTML_ENTITY = '<HTML_ENTITY>';
	const withCurlyBraces = text
		.split(HTML_ENTITY_REGEX())
		.map((word) => (word === '' ? '' : `{${JSON.stringify(word)}}`))
		.join(HTML_ENTITY);

	const htmlEntities = text.match(HTML_ENTITY_REGEX())!;
	return htmlEntities.reduce(
		(acc, htmlEntity) => acc.replace(HTML_ENTITY, htmlEntity),
		withCurlyBraces,
	);
}

function wrapWithCurlyBraces(rawText: string) {
	if (!containsLineTerminators(rawText)) {
		return `{${JSON.stringify(rawText)}}`;
	}

	return rawText
		.split('\n')
		.map((line) => {
			if (line.trim() === '') {
				return line;
			}
			const firstCharIndex = line.search(/[^\s]/);
			const leftWhitespace = line.slice(0, firstCharIndex);
			const text = line.slice(firstCharIndex);

			if (containsHTMLEntity(line)) {
				return `${leftWhitespace}${wrapNonHTMLEntities(text)}`;
			}
			return `${leftWhitespace}{${JSON.stringify(text)}}`;
		})
		.join('\n');
}

function isWhiteSpaceLiteral(node: AnyNode) {
	return node.type && node.type === 'Literal' && node.value && isWhiteSpaces(node.value);
}

function isStringWithTrailingWhiteSpaces(value: string) {
	return /^\s|\s$/.test(value);
}

function isLiteralWithTrailingWhiteSpaces(node: AnyNode) {
	return (
		node.type &&
		node.type === 'Literal' &&
		node.value &&
		isStringWithTrailingWhiteSpaces(node.value)
	);
}

/**
 * TSRX: a comment in text. `/*` starts one anywhere, and `//` after
 * whitespace, at the start of a line, or right after a tag, `{…}` or block.
 */
const regex_comment_start = /\/\*|(?:^|\s)\/\//;

/**
 * TSRX: a directive in text. `@if`, `@switch` and `@for` start one before a
 * `(`, and `@for` also before `await (`.
 */
const regex_directive_start = /@(?:(?:if|switch|for)\s*\(|for\s+await\s*\()/;

const DIRECTIVE_TYPES = new Set([
	'JSXIfExpression',
	'JSXForExpression',
	'JSXSwitchExpression',
	'JSXTryExpression',
]);

/**
 * TSRX: whether `<style>` or `<script>` holds `node`. The first child of a
 * `<style>` decides what it is: text makes it a scoped style block, while
 * `{css}` keeps it an ordinary element. A `<script>` body is raw text.
 */
function is_in_raw_text_element(node: AnyNode) {
	const name = node.parent?.openingElement?.name;
	return name?.type === 'JSXIdentifier' && (name.name === 'style' || name.name === 'script');
}

/**
 * TSRX: whether `text`, written as text in place of the child `node`, would
 * read as TSRX syntax. The new text joins the text beside it, so the check
 * reads that run of text and the children on either side of it.
 */
function reads_as_tsrx_syntax(
	node: AnyNode,
	text: string,
	sourceCode: Rule.RuleContext['sourceCode'],
) {
	if (is_in_raw_text_element(node)) return true;
	const children: AnyNode[] = node.parent.children;
	const index = children.indexOf(node);
	const before = children[index - 1]?.type === 'JSXText' ? children[index - 1] : null;
	const after = children[index + 1]?.type === 'JSXText' ? children[index + 1] : null;
	const run =
		(before ? sourceCode.getText(before as Rule.Node) : '') +
		text +
		(after ? sourceCode.getText(after as Rule.Node) : '');
	const previous = children[index - (before ? 2 : 1)];
	const next = children[index + (after ? 2 : 1)];
	return (
		regex_comment_start.test(run) ||
		regex_directive_start.test(run) ||
		// `@try` starts a directive before a `{`, which a `{…}` after the run supplies.
		(next?.type === 'JSXExpressionContainer' && /@try\s*$/.test(run)) ||
		// `@else`, `@empty`, `@pending` and `@catch` continue a directive's block.
		(DIRECTIVE_TYPES.has(previous?.type) && /^\s*@(?:else|empty|pending|catch)(?![\w$])/.test(run))
	);
}

const messages = {
	unnecessaryCurly: 'Curly braces are unnecessary here.',
	missingCurly: 'Need to wrap this literal in a JSX expression.',
};

const rule: Rule.RuleModule = {
	meta: {
		type: 'suggestion',
		docs: {
			description:
				'Disallow unnecessary JSX expressions when literals alone are sufficient or enforce JSX expressions on literals in JSX children or attributes, without unwrapping text that TSRX reads as syntax',
		},
		fixable: 'code',

		messages,

		schema: [
			{
				anyOf: [
					{
						type: 'object',
						properties: {
							props: { enum: OPTION_VALUES },
							children: { enum: OPTION_VALUES },
							propElementValues: { enum: OPTION_VALUES },
						},
						additionalProperties: false,
					},
					{
						enum: OPTION_VALUES,
					},
				],
			},
		],
	},

	create(context) {
		const sourceCode = context.sourceCode;
		const getText = (node: AnyNode) => sourceCode.getText(node as Rule.Node);
		const ruleOptions = context.options[0];
		const userConfig =
			typeof ruleOptions === 'string'
				? { props: ruleOptions, children: ruleOptions, propElementValues: OPTION_IGNORE }
				: Object.assign({}, DEFAULT_CONFIG, ruleOptions);

		/**
		 * Report and fix an unnecessary curly brace violation on a node
		 */
		function reportUnnecessaryCurly(JSXExpressionNode: AnyNode) {
			context.report({
				node: JSXExpressionNode as Rule.Node,
				messageId: 'unnecessaryCurly',
				fix(fixer) {
					const expression = JSXExpressionNode.expression;

					let textToReplace;
					if (isJSX(expression)) {
						textToReplace = getText(expression);
					} else {
						const expressionType = expression && expression.type;
						const parentType = JSXExpressionNode.parent.type;

						if (parentType === 'JSXAttribute') {
							if (expressionType !== 'TemplateLiteral' && /["]/.test(expression.raw.slice(1, -1))) {
								textToReplace = expression.raw;
							} else {
								textToReplace = `"${
									expressionType === 'TemplateLiteral'
										? expression.quasis[0].value.raw
										: expression.raw.slice(1, -1)
								}"`;
							}
						} else if (isJSX(expression)) {
							textToReplace = getText(expression);
						} else {
							textToReplace =
								expressionType === 'TemplateLiteral'
									? expression.quasis[0].value.cooked
									: expression.value;
						}
					}

					return fixer.replaceText(JSXExpressionNode as Rule.Node, textToReplace);
				},
			});
		}

		function reportMissingCurly(literalNode: AnyNode) {
			context.report({
				node: literalNode as Rule.Node,
				messageId: 'missingCurly',
				fix(fixer) {
					if (isJSX(literalNode)) {
						return fixer.replaceText(literalNode as Rule.Node, `{${getText(literalNode)}}`);
					}

					// If a HTML entity name is found, bail out because it can be fixed
					// by either using the real character or the unicode equivalent.
					// If it contains any line terminator character, bail out as well.
					if (
						containsOnlyHtmlEntities(literalNode.raw) ||
						(literalNode.parent.type === 'JSXAttribute' &&
							containsLineTerminators(literalNode.raw)) ||
						isLineBreak(literalNode.raw)
					) {
						return null;
					}

					const expression =
						literalNode.parent.type === 'JSXAttribute'
							? `{"${escapeDoubleQuotes(escapeBackslashes(literalNode.raw.slice(1, -1)))}"}`
							: wrapWithCurlyBraces(literalNode.raw);

					return fixer.replaceText(literalNode as Rule.Node, expression);
				},
			});
		}

		// Bail out if there is any character that needs to be escaped in JSX
		// because escaping decreases readability and the original code may be more
		// readable anyway or intentional for other specific reasons
		function lintUnnecessaryCurly(JSXExpressionNode: AnyNode) {
			const expression = JSXExpressionNode.expression;
			const expressionType = expression.type;

			// Curly braces containing comments are necessary
			if (sourceCode.getCommentsInside(JSXExpressionNode as Rule.Node).length > 0) {
				return;
			}

			// TSRX: braces that keep text from reading as TSRX syntax are necessary.
			const isTsrxChild = JSXExpressionNode.parent.type !== 'JSXAttribute';

			if (
				(expressionType === 'Literal' || expressionType === 'JSXText') &&
				typeof expression.value === 'string' &&
				((JSXExpressionNode.parent.type === 'JSXAttribute' && !isWhiteSpaceLiteral(expression)) ||
					!isLiteralWithTrailingWhiteSpaces(expression)) &&
				!containsMultilineComment(expression.value) &&
				!needToEscapeCharacterForJSX(expression.raw, JSXExpressionNode) &&
				(isJSX(JSXExpressionNode.parent) ||
					!containsQuoteCharacters(expression.value) ||
					typeof expression.value === 'string')
			) {
				if (isTsrxChild && reads_as_tsrx_syntax(JSXExpressionNode, expression.value, sourceCode)) {
					return;
				}
				reportUnnecessaryCurly(JSXExpressionNode);
			} else if (
				expressionType === 'TemplateLiteral' &&
				expression.expressions.length === 0 &&
				expression.quasis[0].value.raw.indexOf('\n') === -1 &&
				!isStringWithTrailingWhiteSpaces(expression.quasis[0].value.raw) &&
				!needToEscapeCharacterForJSX(expression.quasis[0].value.raw, JSXExpressionNode) &&
				!containsQuoteCharacters(expression.quasis[0].value.cooked)
			) {
				if (
					isTsrxChild &&
					reads_as_tsrx_syntax(JSXExpressionNode, expression.quasis[0].value.cooked, sourceCode)
				) {
					return;
				}
				reportUnnecessaryCurly(JSXExpressionNode);
			} else if (isJSX(expression)) {
				if (isTsrxChild && is_in_raw_text_element(JSXExpressionNode)) return;
				reportUnnecessaryCurly(JSXExpressionNode);
			}
		}

		function areRuleConditionsSatisfied(parent: AnyNode, config: AnyNode, ruleCondition: string) {
			return (
				(parent.type === 'JSXAttribute' &&
					typeof config.props === 'string' &&
					config.props === ruleCondition) ||
				(isJSX(parent) && typeof config.children === 'string' && config.children === ruleCondition)
			);
		}

		function getAdjacentSiblings(node: AnyNode, children: AnyNode[]) {
			for (let i = 1; i < children.length - 1; i++) {
				const child = children[i];
				if (node === child) {
					return [children[i - 1], children[i + 1]];
				}
			}
			if (node === children[0] && children[1]) {
				return [children[1]];
			}
			if (node === children[children.length - 1] && children[children.length - 2]) {
				return [children[children.length - 2]];
			}
			return [];
		}

		function hasAdjacentJsxExpressionContainers(node: AnyNode, children: AnyNode[] | undefined) {
			if (!children) {
				return false;
			}
			const childrenExcludingWhitespaceLiteral = children.filter(
				(child) => !isWhiteSpaceLiteral(child),
			);
			const adjSiblings = getAdjacentSiblings(node, childrenExcludingWhitespaceLiteral);

			return adjSiblings.some((x) => x.type && x.type === 'JSXExpressionContainer');
		}

		function hasAdjacentJsx(node: AnyNode, children: AnyNode[] | undefined) {
			if (!children) {
				return false;
			}
			const childrenExcludingWhitespaceLiteral = children.filter(
				(child) => !isWhiteSpaceLiteral(child),
			);
			const adjSiblings = getAdjacentSiblings(node, childrenExcludingWhitespaceLiteral);

			return adjSiblings.some(
				(x) => x.type && (x.type === 'JSXExpressionContainer' || x.type === 'JSXElement'),
			);
		}

		function shouldCheckForUnnecessaryCurly(node: AnyNode, config: AnyNode) {
			const parent = node.parent;
			// Bail out if the parent is a JSXAttribute & its contents aren't
			// StringLiteral or TemplateLiteral since e.g
			// <App prop1={<CustomEl />} prop2={<CustomEl>...</CustomEl>} />

			if (
				parent.type &&
				parent.type === 'JSXAttribute' &&
				node.expression &&
				node.expression.type &&
				node.expression.type !== 'Literal' &&
				node.expression.type !== 'StringLiteral' &&
				node.expression.type !== 'TemplateLiteral'
			) {
				return false;
			}

			// If there are adjacent `JsxExpressionContainer` then there is no need,
			// to check for unnecessary curly braces.
			if (isJSX(parent) && hasAdjacentJsxExpressionContainers(node, parent.children)) {
				return false;
			}
			if (containsWhitespaceExpression(node) && hasAdjacentJsx(node, parent.children)) {
				return false;
			}
			if (parent.children && parent.children.length === 1 && containsWhitespaceExpression(node)) {
				return false;
			}

			return areRuleConditionsSatisfied(parent, config, OPTION_NEVER);
		}

		function shouldCheckForMissingCurly(node: AnyNode, config: AnyNode) {
			if (isJSX(node)) {
				return config.propElementValues !== OPTION_IGNORE;
			}
			if (isLineBreak(node.raw) || containsOnlyHtmlEntities(node.raw)) {
				return false;
			}
			const parent = node.parent;
			if (
				parent.children &&
				parent.children.length === 1 &&
				containsWhitespaceExpression(parent.children[0])
			) {
				return false;
			}
			// TSRX: the text of a `<style>` or `<script>` is raw.
			if (is_in_raw_text_element(node)) {
				return false;
			}

			return areRuleConditionsSatisfied(parent, config, OPTION_ALWAYS);
		}

		return {
			'JSXAttribute > JSXExpressionContainer > JSXElement'(node: AnyNode) {
				if (userConfig.propElementValues === OPTION_NEVER) {
					reportUnnecessaryCurly(node.parent);
				}
			},

			JSXExpressionContainer(node: AnyNode) {
				if (shouldCheckForUnnecessaryCurly(node, userConfig)) {
					lintUnnecessaryCurly(node);
				}
			},

			'JSXAttribute > JSXElement, Literal, JSXText'(node: AnyNode) {
				if (shouldCheckForMissingCurly(node, userConfig)) {
					reportMissingCurly(node);
				}
			},
		} as Rule.RuleListener;
	},
};

export default rule;
