import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "docs/**",
      "node_modules/**",
      "target/**",
      "src-tauri/target/**",
      "src/bindings.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts", "vitest.config.ts"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
    },
  },
  {
    files: ["src/**/*.test.{ts,tsx}", "src/test/**/*.ts"],
    languageOptions: {
      globals: {
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
      },
    },
  },
  prettier,
);
