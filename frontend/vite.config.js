import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		allowedHosts: ['.trycloudflare.com'],
		proxy: {
			// Frontend calls /api/..., backend exposes /symbols and /analyze.
			'/api': {
				target: 'http://localhost:8000',
				rewrite: (path) => path.replace(/^\/api/, '')
			}
		}
	}
});