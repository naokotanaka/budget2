import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Node.jsアダプターのオプション
			bodyParser: {
				sizeLimit: 52428800 // 50MB in bytes
			}
		}),
		paths: {
			base: '/budget2'
		},
		csrf: {
			// CSRF保護の設定
			// 開発環境では完全に無効化
			checkOrigin: false
		}
	}
};

export default config;