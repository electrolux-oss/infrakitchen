import { defineConfig } from "eslint/config";
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import react from "eslint-plugin-react";
import unusedImports from "eslint-plugin-unused-imports";
import importPlugin from 'eslint-plugin-import';
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default defineConfig([{
  extends: fixupConfigRules(compat.extends(
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "prettier",
  )),

  plugins: {
    "@typescript-eslint": typescriptEslint,
    react: fixupPluginRules(react),
    "unused-imports": unusedImports,
    "import": importPlugin,
  },

  languageOptions: {
    globals: {
      ...globals.browser,
      "RequestInit": true,
    },

    parser: tsParser,
  },

  settings: {
    react: {
      version: "detect",
    },
  },

  rules: {
    "no-console": "error",
    "no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "import/prefer-default-export": "off",
    "react-hooks/exhaustive-deps": "error",

    "import/order": ["error", {
      "groups": [
        "builtin",
        "external",
        "internal",
        "parent",
        "sibling",
        "index"
      ],
      "newlines-between": "always",
      "alphabetize": {
        "order": "asc",
        "caseInsensitive": true
      },
      "pathGroups": [{
        "pattern": "react",
        "group": "external",
        "position": "before"
      }, {
        "pattern": "react-**",
        "group": "external",
        "position": "before"
      }],
      "pathGroupsExcludedImportTypes": ["react"],
    }],

    "unused-imports/no-unused-vars": ["error", {
      vars: "all",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      args: "after-used",
      argsIgnorePattern: "^_",
    }],
  },
}]);
