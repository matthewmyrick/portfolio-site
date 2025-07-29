export interface ParsedCommand {
	command: string;
	args: Record<string, string | boolean>;
	parts: string[];
}

export function parseCommand(input: string): ParsedCommand {
	const parts = input.match(/(\".*?\"|'.*?'|\s+|\S+)/g) || [];
	const firstPartIndex = parts.findIndex((p) => p.trim() !== '');
	const command = firstPartIndex !== -1 ? parts[firstPartIndex].trim().toLowerCase() : '';
	const args: Record<string, string | boolean> = {};

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i].trim();
		if (part.startsWith('--')) {
			const flag = part.substring(2);
			let valueIndex = i + 1;
			while (valueIndex < parts.length && parts[valueIndex].trim() === '') {
				valueIndex++;
			}
			if (valueIndex < parts.length && !parts[valueIndex].trim().startsWith('--')) {
				const value = parts[valueIndex].trim().replace(/^["']|["']$/g, '');
				args[flag] = value;
				i = valueIndex;
			} else {
				args[flag] = true;
			}
		}
	}
	return { command, args, parts };
}