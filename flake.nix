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
          if [ ! -d "ui/node_modules" ]; then
            cd ui
            echo "Installing Node.js dependencies..."
            ${pkgs.yarn}/bin/yarn install
            cd ..
          fi
          '';

      in
      {
        devShells.default = pkgs.mkShell {
          NIX_LD_LIBRARY_PATH = lib.makeLibraryPath [
            pkgs.stdenv.cc.cc
          ];
          packages = [
            pkgs.git
            pkgs.nodejs_24
            pkgs.opentofu
            pkgs.rabbitmq-server
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

            # Start RabbitMQ server
            # Set RabbitMQ environment variables
            export RABBITMQ_LOGS=$PWD/ik_data/rabbitmqdata/logs
            export RABBITMQ_MNESIA_BASE=$PWD/ik_data/rabbitmqdata/mnesia
            export RABBITMQ_PLUGINS_DIR=${pkgs.rabbitmq-server}/plugins
            export RABBITMQ_ENABLED_PLUGINS_FILE=$PWD/ik_data/rabbitmqdata/enabled_plugins
            export RABBITMQ_NODENAME=rabbit@localhost
            export RABBITMQ_PID_FILE=$RABBITMQ_MNESIA_BASE/$RABBITMQ_NODENAME.pid
            echo "Starting RabbitMQ server..."
            ${pkgs.erlang}/bin/epmd -daemon
            ${pkgs.rabbitmq-server}/sbin/rabbitmq-server -detached
            ${pkgs.rabbitmq-server}/sbin/rabbitmqctl wait $RABBITMQ_PID_FILE --timeout 240
            ${pkgs.rabbitmq-server}/sbin/rabbitmq-plugins enable rabbitmq_management

            echo ""
            echo "RabbitMQ is ready!"
            echo "Management Dashboard: http://localhost:15672"
            echo "PID file: $RABBITMQ_PID_FILE"
            echo "Base folder: $RABBITMQ_MNESIA_BASE"
            echo "Log folder: $RABBITMQ_LOGS"
            echo ""

            stop_rabbitmq() {
              echo "Stopping RabbitMQ server..."
              ${pkgs.rabbitmq-server}/sbin/rabbitmqctl stop
              ${pkgs.erlang}/bin/epmd -kill
            }


            # Init InfraKitchen Python server
            export UV_PYTHON_INSTALL_DIR=${UV_PYTHON_INSTALL_DIR}
            export UV_PYTHON=${pkgs.python314}/bin/python3

            ${pkgs.bash}/bin/bash ${initPythonServerScript}

            # Init Node.js modules
            ${pkgs.bash}/bin/bash ${initNodeModulesScript}

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
            }

            echo "Starting InfraKitchen services..."
            start_ik_services() {
              start_backend
              start_frontend
              echo "Development environment started."
            }

            start_ik_services

            stop_server() {
              echo "Stopping InfraKitchen services..."
              stop_ik_services
              stop_rabbitmq
              stop_db
            }

            # Set a hook to stop the database when exiting the shell
            trap stop_server EXIT
          '';
        };
      });
}
