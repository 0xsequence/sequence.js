/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENV: 'local' | 'cors-anywhere' | 'dev' | 'prod'
  readonly VITE_USE_V3_RELAYERS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
