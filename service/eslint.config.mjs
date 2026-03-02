import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["cdk.out/", "node_modules/"] },
  ...tseslint.configs.recommended,
  prettierConfig
);
