import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'fs';
import dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config();

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		https: {
			key: fs.readFileSync('certs/key.pem'),
			cert: fs.readFileSync('certs/cert.pem')
		},
		// WebSocket HMR設定
		hmr: {
			port: 3002,
			host: 'localhost',
			clientPort: 3002
		}
	}
});