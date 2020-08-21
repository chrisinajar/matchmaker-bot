module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parser: "babel-eslint",
  parserOptions: {
    ecmaVersion: "2018",
  },
  extends: ["airbnb", "prettier"],
  plugins: ["prettier"],
  rules: {
    "no-use-before-define": ["error", { functions: false }],
    "import/prefer-default-export": 0,
  },
};
