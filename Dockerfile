# for now this dockerfile is intended for linking the dependencies needed by wallet webapp v3
FROM node:20-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml package.json ./
RUN pnpm fetch --prod

COPY . .

RUN pnpm run build

FROM node:20-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages


RUN cd packages/wallet/core && pnpm link && \
    cd ../wdk && pnpm link && \
    cd ../primitives && pnpm link