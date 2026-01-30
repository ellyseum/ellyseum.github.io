/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GROQ_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
