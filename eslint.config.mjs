import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { moduleBoundariesRule } from "./ops/eslint-boundaries.mjs";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    plugins: {
      cherryk: { rules: { "module-boundaries": moduleBoundariesRule } },
    },
    rules: { "cherryk/module-boundaries": "error" },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "dist/**", "coverage/**"],
  },
];

export default eslintConfig;
