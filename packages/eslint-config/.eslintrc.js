module.exports = {
  $schema: "https://json.schemastore.org/eslintrc",
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  env: {
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {
    "prettier/prettier": [
      "error",
      {
        arrowParens: "avoid",
        bracketSameLine: true,
        htmlWhitespaceSensitivity: "css",
        proseWrap: "always",
        singleQuote: false,
        printWidth: 100,
        plugins: [],
        semi: true,
        tabWidth: 2,
        useTabs: false,
        jsxSingleQuote: false,
        quoteProps: "consistent",
        bracketSpacing: true,
        endOfLine: "lf",
        trailingComma: "all",
      },
    ],
    "no-console": "warn",
    "no-debugger": "error",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-inferrable-types": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        varsIgnorePattern: "_",
      },
    ],
  },
  overrides: [
    {
      files: ["**/test/**/*.test.{j,t}s?(x)"],
      env: { jest: true, node: true },
      rules: {
        "@typescript-eslint/ban-ts-comment": "off",
      },
    },
  ],
  ignorePatterns: [
    "node_modules",
    "**/node_modules/**/*",
    "**/dist/**",
    "dist",
  ],
};
