import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import eslintReact from "@eslint-react/eslint-plugin";
import unicorn from "eslint-plugin-unicorn";
import sonarjs from "eslint-plugin-sonarjs";
import importX from "eslint-plugin-import-x";
import jsxA11y from "eslint-plugin-jsx-a11y";
import perfectionist from "eslint-plugin-perfectionist";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "dev-dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked, eslintReact.configs.strict, unicorn.configs.recommended, sonarjs.configs.recommended, importX.flatConfigs.recommended, importX.flatConfigs.typescript, jsxA11y.flatConfigs.strict, perfectionist.configs["recommended-natural"]],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          project: ["./tsconfig.json"],
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      "unicorn/name-replacements": [
        "error",
        {
          replacements: {
            ref: false,
            inputRef: false,
            props: false,
          },
        },
      ],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "all",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/await-thenable": "error",

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",

      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/no-unnecessary-type-parameters": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/member-ordering": "error",
      "@typescript-eslint/naming-convention": ["error", { selector: "typeLike", format: ["PascalCase"] }, { selector: "enumMember", format: ["UPPER_CASE"] }],

      "@eslint-react/no-array-index-key": "error",
      "@eslint-react/no-leaked-conditional-rendering": "error",

      "sonarjs/cognitive-complexity": ["error", 15],
      "sonarjs/no-duplicate-string": "error",
      "sonarjs/no-identical-functions": "error",

      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true, camelCase: true } }],
      "unicorn/no-array-reduce": "off",
      "unicorn/consistent-class-member-order": "off",
      "unicorn/max-nested-calls": ["error", { max: 3 }],
      "unicorn/number-literal-case": [
        "error",
        {
          hexadecimalValue: "lowercase",
        },
      ],

      "import-x/no-cycle": "error",
      "import-x/no-self-import": "error",
      "import-x/no-duplicates": "error",
      "import-x/no-named-as-default-member": "off",

      "perfectionist/sort-classes": "off",

      "jsx-a11y/media-has-caption": "off",
    },
  },

  {
    files: ["**/*.tsx"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "unicorn/prefer-await": "off",
    },
  },
);
