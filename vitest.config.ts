import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],

  test: {
    coverage: {
      provider: "c8",
    },
    passWithNoTests: true,

    include: ["src/functions/**/*.{spec,test}.ts"],
    exclude: ["node_modules", "dist", ".serverless"],
    watchExclude: ["node_modules", "dist", ".serverless"],
  },
});
