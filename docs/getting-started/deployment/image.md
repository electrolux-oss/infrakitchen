# Docker Deployment

### Use Docker Image for Production Deployment

The following Dockerfile executes the multi-stage build. Save file as `Dockerfile` in the root directory of the project.

```Dockerfile

FROM docker.io/library/python:3.14-trixie@sha256:dcf12835490de651661bfc30235de1233cf167435ea167c37ba9786affc5dbab AS python_builder
RUN apt-get update && apt-get install -y curl unzip

RUN curl -sSL https://github.com/opentofu/opentofu/releases/download/v1.10.6/tofu_1.10.6_linux_amd64.zip -o tofu.zip && \
  unzip -q tofu.zip

WORKDIR /app

COPY ./server /app

# install UV
RUN pip install --no-cache-dir uv && uv sync --no-dev --frozen
RUN mkdir -p build; cp -r src/* build/; cp .env pyproject.toml README.md uv.lock build


FROM node:24.6.0-bookworm-slim@sha256:9b741b28148b0195d62fa456ed84dd6c953c1f17a3761f3e6e6797a754d9edff AS node_builder

WORKDIR /app
COPY ./ui /app
RUN corepack enable && CI=true pnpm install --frozen-lockfile && pnpm build


FROM docker.io/library/python:3.14-trixie@sha256:dcf12835490de651661bfc30235de1233cf167435ea167c37ba9786affc5dbab

RUN apt-get update && apt-get install -y git nginx && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash infrakitchen

COPY ./docs/examples/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY ./docs/examples/docker/websocket-map.conf /etc/nginx/conf.d/websocket-map.conf
COPY --from=node_builder /app/dist /usr/share/nginx/html

RUN mkdir -p /var/lib/nginx /var/log/nginx /run/nginx && \
  chown -R infrakitchen:infrakitchen /var/lib/nginx /var/log/nginx /run/nginx /etc/nginx /usr/share/nginx/html

RUN sed -i -e 's/^user www-data;/# user www-data;/' -e 's|pid /run/nginx.pid;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf

WORKDIR /app

COPY --from=python_builder /app/build /app
COPY --from=python_builder /app/.venv /app/.venv
COPY --from=python_builder /tofu /usr/local/bin/tofu
COPY ./docs/examples/docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh && \
  chown -R infrakitchen:infrakitchen /app /home/infrakitchen

RUN chmod +x /usr/local/bin/tofu

ENV ENV=production
ENV HOME=/home/infrakitchen
ENV PATH=$PATH:.venv/bin
USER infrakitchen
ENTRYPOINT ["/app/entrypoint.sh"]
```

To build the docker image, run the following command from the root directory of the project:

```bash
docker build -t your-image-name:tag .
```
