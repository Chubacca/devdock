// Minimal ambient declaration so we can read NODE_ENV without depending on
// @types/node. Bundlers replace `process.env.NODE_ENV` statically; at runtime
// the access is guarded by a try/catch for environments without `process`.
declare const process: {
  env: { NODE_ENV?: string } & Record<string, string | undefined>;
};

// Vite replaces `import.meta.env.DEV` statically; this keeps the read typed
// without pulling in `vite/client`. `env` itself is missing at runtime under
// every non-Vite bundler (and in plain Node), so the read is wrapped in a
// try/catch rather than an optional chain — Vite only substitutes the exact
// `import.meta.env.DEV` token.
interface ImportMeta {
  readonly env: { readonly DEV?: boolean } & Record<string, unknown>;
}
