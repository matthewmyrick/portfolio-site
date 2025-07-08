<script lang="ts">
	// Define the properties (props) the component will accept.
	type Props = {
		label: string; // The text to display on the button.
		primary?: boolean; // An optional boolean to switch between primary/secondary styles.
		onClick?: (event: MouseEvent) => void; // An optional click event handler.
	};

	// Use Svelte 5's $props() to get the properties passed to the component.
	// We set a default value for 'primary' to be false.
	let { label, primary = false, onClick }: Props = $props();

	// --- Tailwind CSS Classes ---

	// Base classes that apply to all button variants.
	const baseClasses = 'font-bold py-2 px-4 rounded-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-50';

	// Classes for the primary (filled, solid color) button style.
	const primaryClasses = 'bg-cyan-500 text-white hover:bg-cyan-600 focus:ring-cyan-400';

	// Classes for the secondary (outline) button style.
	const secondaryClasses = 'bg-transparent border-2 border-cyan-500 text-cyan-500 hover:bg-cyan-500 hover:text-white focus:ring-cyan-400';

</script>

<!-- 
  The button element itself.
  We combine the base classes with either the primary or secondary classes
  based on the 'primary' prop.
-->
<button
	class="{baseClasses} {primary ? primaryClasses : secondaryClasses}"
	on:click={onClick}
>
	{label}
</button>