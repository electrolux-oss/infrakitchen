#!/usr/bin/env sh
cd ui
yarn install --immutable && yarn format-lib &&
  yarn format && yarn lint && yarn tsc --noEmit && yarn lint-lib
