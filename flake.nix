{
  description = "InfraKitchen development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        inherit (nixpkgs) lib;

        ROOT_DIR="$PWD";
        UV_PYTHON_INSTALL_DIR = "$PWD/ik_data/python/";
        PG_DATA_DIR = "$PWD/ik_data/pgdata";
        PG_PORT = "5432";
        DB_NAME = "infrakitchen";
        DB_USER = "dev_user";
        DB_PASSWORD = "password";

        # Script to initialize the database
        initPostgresqlScript = pkgs.writeText "init-db.sh" ''

            # Create user and database if they don't exist
            if ! ${pkgs.postgresql_17}/bin/psql -U postgres -d postgres -c '\du' | grep -q "${DB_USER}"; then
              echo "Creating user '${DB_USER}'..."
              ${pkgs.postgresql_17}/bin/psql \
              -h $PGHOST \
              -p $PGPORT \
              -U postgres \
              -d postgres \
              -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}' CREATEDB;"

              ${pkgs.postgresql_17}/bin/createuser --createdb "${DB_USER}"
              ${pkgs.postgresql_17}/bin/psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
            fi

            if ! ${pkgs.postgresql_17}/bin/psql -U postgres -lqt | cut -d \| -f 1 | grep -q "${DB_NAME}"; then
              echo "Creating database '${DB_NAME}'..."

              ${pkgs.postgresql_17}/bin/psql \
              -h $PGHOST \
              -p $PGPORT \
              -U postgres \
              -d postgres \
              -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
              echo "✅ PostgreSQL initialized, database '${DB_NAME}' and user '${DB_USER}' created on port ${PG_PORT}."
            fi

        '';

        initPythonServerScript = pkgs.writeText "init-python-server.sh" ''
          # Placeholder for any Python server initialization commands
          echo "Initializing Python server..."
          if [ ! -d "server/.venv" ]; then
            echo "Creating Python virtual environment..."
            ${pkgs.uv}/bin/uv venv server/.venv
          fi
          cd server
          ${pkgs.uv}/bin/uv sync
          cd ..
          source server/.venv/bin/activate
          '';

        initNodeModulesScript = pkgs.writeText "init-node-modules.sh" ''
          # Placeholder for any Node.js initialization commands
          echo "Initializing Node.js modules..."
          cd ui
          ${pkgs.yarn}/bin/yarn install
          cd ..
          '';

        initProviderProxyScript = pkgs.writeText "init-provider-proxy.sh" ''
          echo "Initializing provider proxy..."
          # tofu accepts only HTTPS mirrors, so the proxy gets a self-signed certificate for localhost
          CERT_DIR=ik_data/provider-proxy
          mkdir -p "$CERT_DIR/cache"
          if [ ! -f "$CERT_DIR/cert.pem" ]; then
            ${pkgs.openssl}/bin/openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
              -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" -subj "/CN=localhost" \
              -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
              -addext "basicConstraints=critical,CA:TRUE" \
              -addext "keyUsage=critical,digitalSignature,keyCertSign" \
              -addext "extendedKeyUsage=serverAuth" 2>/dev/null
          fi
          # public CAs + the proxy certificate, used by the backend so tofu trusts the proxy
          cat ${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt "$CERT_DIR/cert.pem" > "$CERT_DIR/ca-bundle.crt"
          '';

      in
      {
        devShells.default = pkgs.mkShell {
          NIX_LD_LIBRARY_PATH = lib.makeLibraryPath [
            pkgs.stdenv.cc.cc
          ];
          packages = [
            pkgs.git
            pkgs.nodejs_26
            pkgs.opentofu
          ];
          # Environment variables for the shell
          shellHook = ''
            export LD_LIBRARY_PATH=$NIX_LD_LIBRARY_PATH
            export ROOT_DIR="${ROOT_DIR}"
            # Set PostgreSQL environment variables
            export PGDATA="${PG_DATA_DIR}"
            export PGHOST="localhost"
            export PGPORT="${PG_PORT}"
            export PGDATABASE="${DB_NAME}"
            export PGUSER="${DB_USER}"
            export PGPASSWORD="${DB_PASSWORD}"

            # Check if the database directory exists (i.e., if it's already initialized)
            if [ ! -d "$PGDATA" ]; then
              echo "Initializing PostgreSQL database in $PGDATA..."
              # Initialize the database cluster, using 'trust' authentication for local setup
              ${pkgs.postgresql_17}/bin/initdb -D $PGDATA --auth=trust --username=postgres
              echo "unix_socket_directories = '$PGDATA'" >> $PGDATA/postgresql.conf
            fi

            # Start temporary server to run the setup script
            ${pkgs.postgresql_17}/bin/pg_ctl -D $PGDATA -l ik_data/postgres.log -o "-p $PGPORT" start

            # Wait for it to be ready
            ${pkgs.postgresql_17}/bin/pg_isready -h $PGHOST -p $PGPORT -t 5

            # Run the script to create user and database
            ${pkgs.bash}/bin/bash ${initPostgresqlScript}

            # Function to stop the database
            stop_db() {
              echo "Stopping PostgreSQL..."
              ${pkgs.postgresql_17}/bin/pg_ctl -D $PGDATA stop
            }

            # Init InfraKitchen Python server
            export UV_PYTHON_INSTALL_DIR=${UV_PYTHON_INSTALL_DIR}
            export UV_PYTHON=${pkgs.python315}/bin/python3

            ${pkgs.bash}/bin/bash ${initPythonServerScript}

            # Init Node.js modules
            ${pkgs.bash}/bin/bash ${initNodeModulesScript}

            # Init provider proxy (caching proxy for tofu providers), PROVIDER_PROXY_PORT=0 disables it
            export PROVIDER_PROXY_PORT="''${PROVIDER_PROXY_PORT:-8090}"
            if [ "$PROVIDER_PROXY_PORT" != "0" ]; then
              ${pkgs.bash}/bin/bash ${initProviderProxyScript}
              export TF_PROVIDER_MIRROR_URL="''${TF_PROVIDER_MIRROR_URL:-https://localhost:$PROVIDER_PROXY_PORT/}"
              export SSL_CERT_FILE="$ROOT_DIR/ik_data/provider-proxy/ca-bundle.crt"
            fi

            # Start InfraKitchen Services

            start_backend() {
              echo "Starting Python backend..."
              cd "$ROOT_DIR/server"
              ./.venv/bin/watchmedo auto-restart -d ./ -p '*.py' --recursive -- ./.venv/bin/python3 dev_server.py &
              echo $! >>"$ROOT_DIR/ik_data/ik_backend.pid"
              cd "$ROOT_DIR"
            }

            start_frontend() {
              echo "Starting frontend..."
              cd "$ROOT_DIR/ui"
              ./node_modules/.bin/vite &
              echo $! >>"$ROOT_DIR/ik_data/ik_frontend.pid"
              cd "$ROOT_DIR"
            }

            start_provider_proxy() {
              if [ "$PROVIDER_PROXY_PORT" = "0" ]; then
                return
              fi
              echo "Starting provider proxy on https://localhost:$PROVIDER_PROXY_PORT ..."
              cd "$ROOT_DIR/provider-proxy"
              # runs with the server venv, like in the InfraKitchen image
              CACHE_DIR="$ROOT_DIR/ik_data/provider-proxy/cache" "$ROOT_DIR/server/.venv/bin/uvicorn" app:app \
                --host 127.0.0.1 --port "$PROVIDER_PROXY_PORT" \
                --ssl-keyfile "$ROOT_DIR/ik_data/provider-proxy/key.pem" \
                --ssl-certfile "$ROOT_DIR/ik_data/provider-proxy/cert.pem" &
              echo $! >>"$ROOT_DIR/ik_data/ik_provider_proxy.pid"
              cd "$ROOT_DIR"
            }

            stop_provider_proxy() {
              if [ -f "$ROOT_DIR/ik_data/ik_provider_proxy.pid" ]; then
                echo "Stopping provider proxy..."
                kill $(cat "$ROOT_DIR/ik_data/ik_provider_proxy.pid") || true
                rm "$ROOT_DIR/ik_data/ik_provider_proxy.pid"
              fi
            }

            stop_backend() {
              echo "Stopping Python backend..."
              if [ -f "$ROOT_DIR/ik_data/ik_backend.pid" ]; then
                kill $(cat "$ROOT_DIR/ik_data/ik_backend.pid") || true
                rm "$ROOT_DIR/ik_data/ik_backend.pid"
              fi
            }

            stop_frontend() {
              echo "Stopping frontend..."
              if [ -f "$ROOT_DIR/ik_data/ik_frontend.pid" ]; then
                kill $(cat "$ROOT_DIR/ik_data/ik_frontend.pid") || true
                rm "$ROOT_DIR/ik_data/ik_frontend.pid"
              fi
            }

            stop_ik_services() {
              echo "Stopping development environment..."
              stop_backend
              stop_frontend
              stop_provider_proxy
            }

            echo "Starting InfraKitchen services..."
            start_ik_services() {
              start_provider_proxy
              start_backend
              start_frontend
              echo "Development environment started."
            }

            start_ik_services

            stop_server() {
              echo "Stopping InfraKitchen services..."
              stop_ik_services
              stop_db
            }

            # Set a hook to stop the database when exiting the shell
            trap stop_server EXIT
          '';
        };
      });
}
