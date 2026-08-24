# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=rfly-frontend-npm,target=/root/.npm,sharing=locked \
    npm ci && npm cache clean --force
COPY . .
ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.28-alpine AS runtime
RUN apk add --no-cache gettext \
    && mkdir -p /srv/app /tmp/nginx-client /tmp/nginx-proxy /tmp/nginx-fastcgi /tmp/nginx-uwsgi /tmp/nginx-scgi \
    && chown -R nginx:nginx /srv/app /tmp/nginx-*
COPY --from=build --chown=nginx:nginx /workspace/dist /srv/app
COPY --chown=nginx:nginx docker/nginx.conf.template /etc/nginx/nginx.conf.template
COPY docker/entrypoint.sh /usr/local/bin/frontend-entrypoint
RUN chmod 0444 /usr/local/bin/frontend-entrypoint
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=5 \
  CMD ["wget", "--quiet", "--tries=1", "--spider", "http://127.0.0.1:8080/healthz"]
ENTRYPOINT ["/bin/sh", "/usr/local/bin/frontend-entrypoint"]
CMD ["nginx", "-c", "/tmp/nginx.conf", "-g", "daemon off;"]
