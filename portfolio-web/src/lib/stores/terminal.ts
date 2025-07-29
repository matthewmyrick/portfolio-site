import { writable } from 'svelte/store';

export interface HistoryItem {
	id: number;
	type: 'input' | 'output' | 'error';
	text: string;
}

export interface GameState {
	isActive: boolean;
	targetNumber: number;
	attempts: number;
	maxAttempts: number;
}

export const history = writable<HistoryItem[]>([]);
export const commandHistory = writable<string[]>([]);
export const historyIndex = writable<number>(-1);
export const currentCommand = writable<string>('');
export const cursorPos = writable<number>(0);
export const gameState = writable<GameState>({
	isActive: false,
	targetNumber: 0,
	attempts: 0,
	maxAttempts: 7
});

let nextId = 0;

export function getNextId(): number {
	return nextId++;
}

export function addToHistory(lines: string[], type: 'output' | 'error' = 'output') {
	const newLines = lines.map((text) => ({ id: getNextId(), type, text }));
	history.update(h => [...h, ...newLines]);
}

export function addCommandToHistory(commandHtml: string, command: string) {
	const historyHtml = commandHtml
		.replace(/<span class="cursor-on-char">(.+?)<\/span>/g, '$1')
		.replace('<span class="cursor-at-end"></span>', '');
	
	history.update(h => [...h, { id: getNextId(), type: 'input', text: historyHtml }]);
	commandHistory.update(ch => {
		const newHistory = [...ch, command];
		// Keep only last 10 commands
		const limitedHistory = newHistory.slice(-10);
		historyIndex.set(limitedHistory.length);
		return limitedHistory;
	});
}

export function clearHistory() {
	history.set([]);
}

export function startGame() {
	const targetNumber = Math.floor(Math.random() * 100) + 1;
	gameState.set({
		isActive: true,
		targetNumber,
		attempts: 0,
		maxAttempts: 7
	});
}

export function endGame() {
	gameState.set({
		isActive: false,
		targetNumber: 0,
		attempts: 0,
		maxAttempts: 7
	});
}