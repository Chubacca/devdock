// Minimal ambient declaration so we can read NODE_ENV without depending on
// @types/node. Bundlers replace `process.env.NODE_ENV` statically; at runtime
// the access is guarded by a try/catch for environments without `process`.
declare const process: {
  env: { NODE_ENV?: string } & Record<string, string | undefined>;
};
