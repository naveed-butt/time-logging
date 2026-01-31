import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	root: "src/webview",
	build: {
		outDir: "../../out/webview",
		emptyOutDir: true,
		rollupOptions: {
			input: "src/webview/main.tsx",
			output: {
				entryFileNames: "index.js",
				assetFileNames: "index.[ext]",
			},
		},
	},
});
