import js from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

export default [
  {
    ignores: ["dist/**/*", "node_modules/**/*", "eslint.config.js", "index.cjs"],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: "./tsconfig.json", tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "@stylistic": stylistic,
    },
    rules: {
      "no-alert": "error",
      "@stylistic/semi": ["error", "always"],
      "no-extra-semi": "error",
      "multiline-comment-style": ["error", "starred-block"],
      "spaced-comment": ["error", "never"],
      "line-comment-position": ["error", { position: "above" }],
      "no-warning-comments": ["error", { terms: ["todo", "fixme", "ts-ignore"], location: "anywhere" }],
      "prefer-const": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "all",
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
      "no-unneeded-ternary": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "error",

      "@typescript-eslint/explicit-module-boundary-types": "error",
    },
  },
];
