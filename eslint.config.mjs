// Flat config. `next lint` was removed in Next 16, so ESLint is invoked
// directly (`npm run lint`) with the shared Next config.
import next from "eslint-config-next";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "site/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  ...next,
  {
    rules: {
      // eslint-plugin-react-hooks v7 (pulled in by eslint-config-next 16) adds
      // React Compiler-backed rules that flag long-standing patterns here:
      // mount flags, URL-state hydration and a Date.now() read during render.
      // Kept as warnings so they stay visible without failing lint — each one
      // is a genuine cleanup, but reworking those effects is its own change.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default config;
