import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // This adapter tells SvelteKit to output a static site.
    adapter: adapter({
      // This section configures the output directories.
      pages: 'build',
      assets: 'build',
      fallback: 'index.html', // Important for single-page app routing
      precompress: false,
      strict: true
    })
  }
};

export default config;
