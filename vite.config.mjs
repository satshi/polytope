import { fileURLToPath } from "node:url";

export default {
    root: fileURLToPath(new URL("./src/", import.meta.url)),
    base: "./",
    build: {
        outDir: fileURLToPath(new URL("./dist/", import.meta.url)),
        emptyOutDir: true,
        assetsInlineLimit: 0,
        sourcemap: true,
    },
};
