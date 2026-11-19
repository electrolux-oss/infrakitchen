# Provider proxy

A caching proxy for OpenTofu and Terraform providers. It implements the
[provider network mirror protocol](https://opentofu.org/docs/internals/provider-network-mirror-protocol/):
the first request for a provider downloads it from the upstream registry, later requests get the copy on disk.

It is independent of InfraKitchen (no database, no shared code). InfraKitchen workers use it when
`TF_PROVIDER_MIRROR_URL` is set, see [IaC tools](../docs/operations/iac_tools.mdx).

## How it works

Every response is a file under `CACHE_DIR` at the request path. If the file exists it is served,
otherwise it is built from upstream, written atomically and served.

| Path | Upstream | Cached |
| :-- | :-- | :-- |
| `/<host>/<namespace>/<type>/index.json` | `/v1/providers/<ns>/<type>/versions` | `INDEX_TTL` seconds, the old file is served while upstream is down |
| `/<host>/<namespace>/<type>/<version>.json` | `/download/<os>/<arch>` of every platform | forever |
| `/<host>/<namespace>/<type>/<version>/<os>_<arch>.zip` | `download_url`, checked against `shasum` | forever |

## Settings

| Variable | Default | Description |
| :-- | :-- | :-- |
| `CACHE_DIR` | `/var/cache/provider-proxy` | Where files are stored |
| `UPSTREAMS` | `registry.opentofu.org,registry.terraform.io` | Allowed registries, others get 404 |
| `INDEX_TTL` | `3600` | Seconds before a version list is fetched again |

## Run

The proxy ships in the InfraKitchen image as `/app/provider_proxy.py` (all its dependencies are in the
image). Run the image with another command:

```sh
docker run -p 8090:8090 -v provider-cache:/var/cache/provider-proxy <IMG_NAME> \
  /app/.venv/bin/uvicorn provider_proxy:app --host 0.0.0.0 --port 8090
```

For Kubernetes, see the `infrakitchen-provider-proxy` objects in
[k8s-manifest.yaml](../docs/examples/docker/k8s-manifest.yaml): the proxy is reached through the cluster DNS
(`https://infrakitchen-provider-proxy.<namespace>.svc:8090/`) and is not exposed outside the cluster. It
serves TLS with a certificate from an internal CA, and workers trust that CA through `SSL_CERT_DIR`. Run one
replica per cache volume.

Locally, with the server virtual environment (the proxy has no dependencies of its own):

```sh
cd provider-proxy && ../server/.venv/bin/uvicorn app:app --port 8090
```

OpenTofu and Terraform only accept **HTTPS** mirror URLs, so put the proxy behind TLS (an ingress or a
reverse proxy such as Caddy or nginx), or pass `--ssl-keyfile` / `--ssl-certfile` to uvicorn.

## Client configuration

```hcl
provider_installation {
  network_mirror {
    url     = "https://provider-proxy.example.com/"
    include = ["registry.opentofu.org/*/*", "registry.terraform.io/*/*"]
  }
  direct {
    exclude = ["registry.opentofu.org/*/*", "registry.terraform.io/*/*"]
  }
}
```

Providers of the public registries are installed only through the proxy, so `init` fails while the proxy
is down. Providers of other registries are installed directly.

## Cleanup

Nothing is ever removed. To reclaim space, delete files that were not read for a while, e.g.
`find /var/cache/provider-proxy -name '*.zip' -atime +90 -delete` (needs `atime` on the volume), or
delete the whole directory; it fills up again on demand.

## Tests

```sh
server/.venv/bin/python -m pytest provider-proxy/tests
```
