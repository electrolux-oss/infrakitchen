#!/usr/bin/env sh
cd ui
CI="true" pnpm install --frozen-lockfile && pnpm format-lib &&
  pnpm format && pnpm lint && pnpm exec tsc --noEmit && pnpm lint-lib
