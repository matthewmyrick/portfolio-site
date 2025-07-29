<script lang="ts">
	import type { HistoryItem } from '../stores/terminal.js';

	export let history: HistoryItem[];
</script>

{#each history as item (item.id)}
	<div>
		{#if item.type === 'input'}
			<span class="text-green-400">$</span>
			<span class="ml-2">{@html item.text}</span>
		{:else if item.type === 'output'}
			<div class="whitespace-pre-wrap">{@html item.text}</div>
		{:else if item.type === 'error'}
			<span class="whitespace-pre-wrap text-red-500">{item.text}</span>
		{/if}
	</div>
{/each}