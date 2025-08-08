import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// .envファイルを読み込み
dotenv.config();

// package.jsonを読み込む安全な方法
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

export default defineConfig(({ command, mode }) => ({
	plugins: [sveltekit()],
	define: {
		__BUILD_VERSION__: JSON.stringify(pkg.version),
		__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
		__DEV_MODE__: JSON.stringify(mode === 'development'),
		__BUILD_COMMAND__: JSON.stringify(command), // 'build' or 'serve'
		__BUILD_MODE__: JSON.stringify(mode) // 'development' or 'production'
	},
	server: {
		port: 3002,
		strictPort: true, // ポートが使用中の場合はエラーで停止
		host: true, // すべてのネットワークインターフェースでリッスン、すべてのホストを許可
		// 許可するホストを明示的に設定（Vite 5以降の設定）
		allowedHosts: ['nagaiku.top', 'localhost', '127.0.0.1'],
		fs: {
			allow: ['..']
		},
		// プロダクション用：HTTPで起動（nginxがHTTPS終端を行う）
		// https: {
		//     key: fs.readFileSync('certs/key.pem'),
		//     cert: fs.readFileSync('certs/cert.pem')
		// },
		// WebSocket HMR設定 - HTTPS環境では問題があるため無効化
		hmr: false
	},
	// プロダクションビルドの最適化
	build: {
		// チャンクサイズの最適化
		rollupOptions: {},
		// チャンクサイズ警告の閾値を上げる
		chunkSizeWarningLimit: 1000
	}
}));