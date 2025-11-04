#!/usr/bin/env sh
cd ui
yarn install --immutable && yarn format-lib:check &&
  yarn format:check && yarn lint && yarn tsc --noEmit && yarn lint-lib
