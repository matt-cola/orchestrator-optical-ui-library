# Orchestrator UI with the optical map page.
#
# Builds the standard example-orchestrator-ui app (pinned below) with this
# library installed and the files of example/overlay/ laid over it.
#
#   docker build -f example/Dockerfile -t orchestrator-optical-ui:local .
#
# The build context is the repository root.

FROM node:24-alpine AS library

WORKDIR /library
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm pack --pack-destination /tmp \
    && mv /tmp/orchestrator-optical-ui-library-*.tgz /tmp/orchestrator-optical-ui-library.tgz


FROM node:24-alpine AS builder

ENV NEXT_TELEMETRY_DISABLED=1

# https://github.com/workfloworchestrator/example-orchestrator-ui
ARG EXAMPLE_ORCHESTRATOR_UI_REF=32040b7bef15e9c22f9dced0a49717d9cb5118d6
# The example app's lockfile pins an older release; this one replaces it.
# https://github.com/workfloworchestrator/orchestrator-ui-library/releases
ARG ORCHESTRATOR_UI_COMPONENTS_VERSION=12.0.0

RUN apk add --no-cache git && corepack enable

WORKDIR /app
RUN git init -q . \
    && git remote add origin https://github.com/workfloworchestrator/example-orchestrator-ui.git \
    && git fetch -q --depth 1 origin "${EXAMPLE_ORCHESTRATOR_UI_REF}" \
    && git checkout -q FETCH_HEAD

COPY --from=library /tmp/orchestrator-optical-ui-library.tgz /tmp/orchestrator-optical-ui-library.tgz
RUN pnpm install --frozen-lockfile \
    && pnpm add "@orchestrator-ui/orchestrator-ui-components@${ORCHESTRATOR_UI_COMPONENTS_VERSION}" \
    && pnpm add /tmp/orchestrator-optical-ui-library.tgz

COPY example/overlay/ ./
RUN pnpm run build


FROM node:24-alpine AS runner

ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone /app
COPY --from=builder /app/.next/static /app/.next/static
COPY --from=builder /app/public /app/public

WORKDIR /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]
