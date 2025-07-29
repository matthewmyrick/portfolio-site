import type { CommandDef } from './commandManager.js';
import { parseCommand } from './commandParser.js';

export function generateHighlightedCommand(
	command: string,
	commands: Record<string, CommandDef>,
	cursorPos: number,
	isGameActive: boolean = false
): string {
	// Special handling for game mode - make everything yellow
	if (isGameActive) {
		let html = '';
		let rawTextLength = 0;
		
		const buildHtml = (text: string, className: string) => {
			let result = '';
			for (let i = 0; i < text.length; i++) {
				const char = text[i];
				const renderedChar = char === ' ' ? '&nbsp;' : char;
				if (rawTextLength === cursorPos) {
					result += `<span class="cursor-on-char">${renderedChar}</span>`;
				} else {
					result += renderedChar;
				}
				rawTextLength++;
			}
			return `<span class="${className}">${result}</span>`;
		};

		html += buildHtml(command, 'text-yellow-400');
		
		if (cursorPos >= command.length) {
			html += '<span class="cursor-at-end"></span>';
		}

		return html;
	}

	const { command: mainCommand, parts } = parseCommand(command);
	const commandDef = commands[mainCommand];
	let html = '';
	let rawTextLength = 0;

	const buildHtml = (text: string, className: string) => {
		let result = '';
		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			const renderedChar = char === ' ' ? '&nbsp;' : char;
			if (rawTextLength === cursorPos) {
				result += `<span class="cursor-on-char">${renderedChar}</span>`;
			} else {
				result += renderedChar;
			}
			rawTextLength++;
		}
		return `<span class="${className}">${result}</span>`;
	};

	let partIndex = 0;
	if (parts.length > 0) {
		// Handle leading whitespace
		while (partIndex < parts.length && parts[partIndex].trim() === '') {
			html += buildHtml(parts[partIndex], '');
			partIndex++;
		}

		// Handle main command
		if (partIndex < parts.length) {
			html += buildHtml(parts[partIndex], commandDef ? 'text-green-400' : 'text-red-500');
			partIndex++;
		}

		// Handle arguments and flags
		if (commandDef) {
			while (partIndex < parts.length) {
				const part = parts[partIndex];
				if (part.trim() === '') {
					html += buildHtml(part, '');
				} else if (part.startsWith('--')) {
					const flag = part.substring(2);
					if (mainCommand === 'experience' && ['company', 'help', 'list'].includes(flag)) {
						html += buildHtml(part, 'text-yellow-400');
						if (flag === 'company') {
							let valueIndex = partIndex + 1;
							while (valueIndex < parts.length && parts[valueIndex].trim() === '') {
								html += buildHtml(parts[valueIndex], '');
								valueIndex++;
							}
							if (valueIndex < parts.length) {
								const valuePart = parts[valueIndex];
								const value = valuePart.replace(/^["']|["']$/g, '');
								const companyKey = value.toLowerCase().replace(/[^a-z0-9]/g, '');
								const companyExists =
									commandDef.subCommands && commandDef.subCommands[companyKey];
								html += buildHtml(valuePart, companyExists ? 'text-cyan-400' : 'text-red-500');
								partIndex = valueIndex;
							}
						}
					} else {
						html += buildHtml(part, 'text-red-500');
					}
				} else {
					html += buildHtml(part, 'text-red-500');
				}
				partIndex++;
			}
		} else {
			while (partIndex < parts.length) {
				html += buildHtml(parts[partIndex], 'text-red-500');
				partIndex++;
			}
		}
	}

	if (cursorPos >= command.length) {
		html += '<span class="cursor-at-end"></span>';
	}

	return html;
}