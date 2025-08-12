import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		paths: {
			base: '/budget2'
		},
		csrf: {
			// CSRF保護の設定
			// 開発環境: NODE_ENV=development で自動的に無効化
			// 本番環境: checkOrigin: true （デフォルト）
			checkOrigin: process.env.NODE_ENV === 'production'
		}
	}
};

export default config;