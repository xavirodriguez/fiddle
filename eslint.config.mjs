// eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import tsdoc from "eslint-plugin-tsdoc";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import nextPlugin from "@next/eslint-plugin-next";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  // ── Archivos ignorados ──────────────────────────────────────────
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "temp/**",
      "docs/**",
      "eslint.config.mjs",
      "postcss.config.mjs",
      "public/worklets/**",
    ],
  },

  // ── Base JS ─────────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript ──────────────────────────────────────────────────
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: {
      // ✅ AUTO-FIXABLE: fuerza `import type` cuando el import es solo de tipos
      // Muy relevante: el código ya lo usa en algunos sitios pero no de forma consistente
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // ✅ AUTO-FIXABLE: elimina `as const` redundantes, prefiere aserciones seguras
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "allow-as-parameter",
        },
      ],

      // ✅ AUTO-FIXABLE: `a?.b` en lugar de `a && a.b`
      "@typescript-eslint/prefer-optional-chain": "error",

      // ✅ AUTO-FIXABLE: `a ?? b` en lugar de `a !== null && a !== undefined ? a : b`
      "@typescript-eslint/prefer-nullish-coalescing": "error",

      // ✅ AUTO-FIXABLE: `T[]` en lugar de `Array<T>` (consistencia)
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],

      // ✅ AUTO-FIXABLE: elimina `return` innecesarios en funciones async
      "@typescript-eslint/return-await": ["error", "in-try-catch"],

      // ✅ AUTO-FIXABLE: no-unused-vars con prefijo _ para ignorar intencionalmente
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // ✅ AUTO-FIXABLE: elimina `!` non-null assertions innecesarios
      "@typescript-eslint/no-non-null-assertion": "warn",

      // ✅ AUTO-FIXABLE: no `any` explícito (crítico con branded types)
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  // ── Imports ordenados ────────────────────────────────────────────
  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      // ✅ AUTO-FIXABLE: ordena y agrupa imports automáticamente
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            // 1. Side-effect imports
            ["^\\u0000"],
            // 2. Node builtins
            ["^node:"],
            // 3. Paquetes externos
            ["^@?\\w"],
            // 4. Alias @/ (paths internos)
            ["^@/"],
            // 5. Relativos
            ["^\\."],
          ],
        },
      ],
      // ✅ AUTO-FIXABLE: ordena exports
      "simple-import-sort/exports": "error",
    },
  },

  // ── React ────────────────────────────────────────────────────────
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      // ✅ AUTO-FIXABLE: elimina `import React from 'react'` innecesario (React 19 JSX transform)
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",

      // ✅ AUTO-FIXABLE: self-closing tags cuando no hay children (<Component />)
      "react/self-closing-comp": "error",

      // ✅ AUTO-FIXABLE: boolean props sin valor explícito (<Comp disabled={true}> → <Comp disabled>)
      "react/jsx-boolean-value": ["error", "never"],

      // ✅ AUTO-FIXABLE: fragmentos cortos (<></> en lugar de <React.Fragment>)
      "react/jsx-fragments": ["error", "syntax"],

      // ⚠️ NO fixable pero crítico para hooks en audio/RAF loops
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // ── Next.js ──────────────────────────────────────────────────────
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  // ── SonarJS (ya instalado) ───────────────────────────────────────
  sonarjs.configs.recommended,
  {
    rules: {
      // Ajuste: el proyecto tiene funciones de dominio complejas (reducers, state machines)
      "sonarjs/cognitive-complexity": ["warn", 20],
      // ✅ AUTO-FIXABLE en sonarjs v3
      "sonarjs/no-redundant-jump": "error",
    },
  },

  // ── TSDoc (ya instalado) ─────────────────────────────────────────
  {
    plugins: { tsdoc },
    rules: {
      "tsdoc/syntax": "warn",
    },
  },

  // ── Reglas base JS auto-fixables ─────────────────────────────────
  {
    rules: {
      // ✅ AUTO-FIXABLE
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": "error",
      "no-useless-rename": "error",
      "no-extra-semi": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      // ✅ AUTO-FIXABLE: elimina console.log en producción (útil dado el código de audio)
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // ── Prettier al final (desactiva reglas de formato conflictivas) ──
  prettierConfig
);
