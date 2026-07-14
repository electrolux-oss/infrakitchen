#!/usr/bin/env sh
cd ui
echo "Checking typescript for frontend app"
CI="true" pnpm install --frozen-lockfile && pnpm format-lib:check &&
  pnpm format:check && pnpm lint && pnpm exec tsc --noEmit && pnpm lint-lib

echo "Checking typescript for frontend-lib"
cd frontend-lib
pnpm exec tsc --emitDeclarationOnly
