// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Viteで定義されるビルド時変数
	declare const __BUILD_VERSION__: string;
	declare const __BUILD_TIME__: string;
	declare const __DEV_MODE__: boolean;
	declare const __BUILD_COMMAND__: string;
	declare const __BUILD_MODE__: string;
}

export {};