# Docker Deployment

### Use Docker Image for Production Deployment

The following Dockerfile executes the multi-stage build. Save file as `Dockerfile` in the root directory of the project.

```Dockerfile
FROM docker.io/library/python:3.14.6-slim-bookworm@sha256:86f975aca15cf04a40b399eebede9aea7c82eae084d1f1a0a6ef6bcaae871a30 AS python_builder

ARG TARGETARCH

RUN apt-get update && apt-get install -y --no-install-recommends curl unzip binutils && \
  rm -rf /var/lib/apt/lists/*

RUN case "$TARGETARCH" in \
  amd64) TOFU_ARCH=amd64 ;; \
  arm64) TOFU_ARCH=arm64 ;; \
  *) echo "Unsupported arch: $TARGETARCH" && exit 1 ;; \
  esac && \
  curl -sSL "https://github.com/opentofu/opentofu/releases/download/v1.10.6/tofu_1.10.6_linux_${TOFU_ARCH}.zip" -o tofu.zip && \
  unzip -q tofu.zip

# install awscli v2
RUN case "$TARGETARCH" in \
  amd64) AWSCLI_ARCH=x86_64 ;; \
  arm64) AWSCLI_ARCH=aarch64 ;; \
  *) echo "Unsupported arch: $TARGETARCH" && exit 1 ;; \
  esac && \
  curl -sSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWSCLI_ARCH}.zip" -o awscliv2.zip && \
  unzip -q awscliv2.zip && ./aws/install --bin-dir /aws-cli-bin && \
  rm -rf awscliv2.zip ./aws && \
  rm -rf /usr/local/aws-cli/v2/current/dist/aws_completer /usr/local/aws-cli/v2/current/dist/awscli/data/ac.index /usr/local/aws-cli/v2/current/dist/awscli/examples

WORKDIR /app

COPY ./server /app

# install UV
ENV UV_COMPILE_BYTECODE=1 \
  UV_LINK_MODE=copy \
  UV_NO_CACHE=1

RUN pip install --no-cache-dir uv && \
  uv sync --no-dev --frozen

RUN find /app/.venv -type d -name "__pycache__" -prune -exec rm -rf {} + && \
  find /app/.venv -type d -name "tests" -prune -exec rm -rf {} + && \
  find /app/.venv -type d -name "test" -prune -exec rm -rf {} + && \
  find /app/.venv \( -name "*.pyc" -o -name "*.pyi" -o -name "*.pyx" \) -delete; \
  find /app/.venv -name "*.so" -exec strip --strip-unneeded {} + 2>/dev/null; true

FROM node:26.7.0-bookworm-slim@sha256:c00614442a3c693109886209462dd1b15462f6726347fa9cb9fc0125ca26f275 AS node_builder

RUN apt-get update && apt-get install -y --no-install-recommends git && \
  apt-get clean && rm -rf /var/lib/apt/lists/* && npm install -g corepack

WORKDIR /app
COPY ./ /app
RUN cd ./ui && yarn install --frozen-lockfile && yarn cache clean && yarn build


FROM docker.io/library/python:3.14.6-slim-bookworm@sha256:86f975aca15cf04a40b399eebede9aea7c82eae084d1f1a0a6ef6bcaae871a30

RUN apt-get update && apt-get install -y --no-install-recommends nginx git openssh-client && \
  apt-get clean && rm -rf /var/lib/apt/lists/* && \
  useradd --create-home --shell /bin/bash infrakitchen && \
  mkdir -p /home/infrakitchen/.aws

COPY ./aws_config /home/infrakitchen/.aws/config

COPY ./docs/examples/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY ./docs/examples/docker/websocket-map.conf /etc/nginx/conf.d/websocket-map.conf
COPY --from=node_builder /app/ui/dist /usr/share/nginx/html

RUN mkdir -p /var/lib/nginx /var/log/nginx /run/nginx && \
  chown -R infrakitchen:infrakitchen /var/lib/nginx /var/log/nginx /run/nginx /etc/nginx /usr/share/nginx/html

RUN sed -i -e 's/^user www-data;/# user www-data;/' -e 's|pid /run/nginx.pid;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf

WORKDIR /app

COPY --from=python_builder /app/.venv /app/.venv
COPY --from=python_builder /app/src /app
COPY --from=python_builder /tofu /usr/local/bin/tofu
COPY --from=python_builder /usr/local/aws-cli/ /usr/local/aws-cli/
COPY --from=python_builder /aws-cli-bin/ /usr/local/bin/
COPY --from=python_builder /app/.env /app/.env
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
