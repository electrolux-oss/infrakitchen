# Kubernetes Deployment

For running InfraKitchen on Kubernetes, you can use the following example manifest. Make sure to:

- Replace the placeholders `<SERVICE_ACCOUNT_NAME>`, `<IMG_NAME>`, `<POSTGRES_HOST>`, `<RabbitMQ_URL>` and `<HOST_NAME>` with your actual values.
- RabbitMQ and PostgreSQL services are assumed to be running and accessible from Kubernetes cluster.
- Before applying the manifest, ensure that you have created a Kubernetes Secret for InfraKitchen.

### Create Namespace if Needed and Switch Context to the Namespace

```bash
kubectl create namespace infrakitchen
kubectl config set-context --current --namespace=infrakitchen
```

### Generate Secrets for JWT and Encryption Keys

You can use the following commands to generate base64 encoded secrets:

```bash
python server/generate_encryption_key.py
```

### Replace Values With Getting Values in Previous Step and Apply kubectl Command

```bash
kubectl create secret generic infrakitchen-secrets \
                --from-literal="enc-secret=<REPLACE_VALUE>" \
                --from-literal="jwt-secret=<REPLACE_VALUE>" \
                --from-literal="postgres-password=<REPLACE_VALUE>"
```

### Apply the Manifest

```yaml
---
# Service for InfraKitchen backend
apiVersion: v1
kind: Service
metadata:
  name: infrakitchen
  labels:
    app.kubernetes.io/name: infrakitchen
    app.kubernetes.io/instance: infrakitchen
    app.kubernetes.io/component: infrakitchen
spec:
  type: ClusterIP
  sessionAffinity: None
  ports:
    - name: http-backend
      port: 8080
      targetPort: backend
      protocol: TCP
      nodePort: null
  selector:
    app.kubernetes.io/name: infrakitchen
    app.kubernetes.io/instance: infrakitchen
    app.kubernetes.io/component: infrakitchen
---
# Deployment for InfraKitchen backend
apiVersion: apps/v1
kind: Deployment
metadata:
  name: infrakitchen
  labels:
    app.kubernetes.io/name: infrakitchen
    app.kubernetes.io/instance: infrakitchen
    app.kubernetes.io/component: infrakitchen
  annotations:
spec:
  replicas: 2
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app.kubernetes.io/name: infrakitchen
      app.kubernetes.io/instance: infrakitchen
      app.kubernetes.io/component: infrakitchen
  template:
    metadata:
      labels:
        app.kubernetes.io/name: infrakitchen
        app.kubernetes.io/instance: infrakitchen
        app.kubernetes.io/component: infrakitchen
      annotations:
    spec:
      serviceAccountName: <SERVICE_ACCOUNT_NAME>

      containers:
        - name: infrakitchen-backend
          image: <IMG_NAME>
          imagePullPolicy: "Always"
          resources:
            limits:
              cpu: 200m
              memory: 256Mi
            requests:
              cpu: 100m
              memory: 128Mi
          readinessProbe:
            failureThreshold: 10
            httpGet:
              path: /healthcheck
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
            successThreshold: 1
            timeoutSeconds: 1
          livenessProbe:
            failureThreshold: 10
            httpGet:
              path: /healthcheck
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
            successThreshold: 1
            timeoutSeconds: 1
          env:
            - name: POSTGRES_HOST
              value: <POSTGRES_HOST>
            - name: POSTGRES_PORT
              value: "5432"
            - name: POSTGRES_USER
              value: infrakitchen
            - name: POSTGRES_DB
              value: infrakitchen
            - name: POSTGRES_MIGRATIONS
              value: "true"
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: infrakitchen-secrets
                  key: postgres-password

            - name: BROKER_URL
              value: <RabbitMQ_URL>
              # example value: amqp://guest:password@infrakitchen-rabbitmq:5672
            - name: JWT_KEY
              valueFrom:
                secretKeyRef:
                  name: infrakitchen-secrets
                  key: jwt-secret
            - name: ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: infrakitchen-secrets
                  key: enc-secret
            - name: SESSION_EXPIRATION
              value: "86400"
          ports:
            - name: backend
              containerPort: 8080
              protocol: TCP
---
# Deployment for InfraKitchen scheduler
apiVersion: apps/v1
kind: Deployment
metadata:
  name: infrakitchen-scheduler
  labels:
    app.kubernetes.io/name: infrakitchen
    app.kubernetes.io/instance: infrakitchen
    app.kubernetes.io/component: infrakitchen-scheduler
  annotations:
spec:
  replicas: 1
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app.kubernetes.io/name: infrakitchen
      app.kubernetes.io/instance: infrakitchen
      app.kubernetes.io/component: infrakitchen-scheduler
  template:
    metadata:
      labels:
        app.kubernetes.io/name: infrakitchen
        app.kubernetes.io/instance: infrakitchen
        app.kubernetes.io/component: infrakitchen-scheduler
      annotations:
    spec:
      serviceAccountName: <SERVICE_ACCOUNT_NAME>

      containers:
        - name: infrakitchen-scheduler
          image: <IMG_NAME>
          imagePullPolicy: "Always"
          command:
            - /app/.venv/bin/python
            - scheduler.py
          resources:
            limits:
              cpu: 1000m
              memory: 1024Mi
            requests:
              cpu: 300m
              memory: 256Mi
          env:
            - name: POSTGRES_HOST
              value: <POSTGRES_HOST>
            - name: POSTGRES_PORT
              value: "5432"
            - name: POSTGRES_USER
              value: infrakitchen
            - name: POSTGRES_DB
              value: infrakitchen
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: infrakitchen-secrets
                  key: postgres-password
            - name: BROKER_URL
              value: <RabbitMQ_URL>
              # example value: amqp://guest:password@infrakitchen-rabbitmq:5672
            - name: JWT_KEY
              valueFrom:
                secretKeyRef:
                  name: infrakitchen-secrets
                  key: jwt-secret
            - name: ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: infrakitchen-secrets
                  key: enc-secret
          ports:
            - name: backend
              containerPort: 8080
              protocol: TCP
---
# Deployment for InfraKitchen worker
apiVersion: apps/v1
kind: Deployment
metadata:
  name: infrakitchen-worker
  labels:
    app.kubernetes.io/name: infrakitchen
    app.kubernetes.io/instance: infrakitchen
    app.kubernetes.io/component: infrakitchen-worker
  annotations:
spec:
  replicas: 2
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app.kubernetes.io/name: infrakitchen
      app.kubernetes.io/instance: infrakitchen
      app.kubernetes.io/component: infrakitchen-worker
  template:
    metadata:
      labels:
        app.kubernetes.io/name: infrakitchen
        app.kubernetes.io/instance: infrakitchen
        app.kubernetes.io/component: infrakitchen-worker
      annotations:
    spec:
      serviceAccountName: <SERVICE_ACCOUNT_NAME>

      containers:
        - name: infrakitchen-worker
          image: <IMG_NAME>
          imagePullPolicy: "Always"
          command:
            - /app/.venv/bin/python
            - worker.py
          resources:
            limits:
              cpu: 1000m
              memory: 1024Mi
            requests:
              cpu: 300m
              memory: 256Mi
          env:
            - name: POSTGRES_HOST
              value: <POSTGRES_HOST>
            - name: POSTGRES_PORT
              value: "5432"
            - name: POSTGRES_USER
              value: infrakitchen
            - name: POSTGRES_DB
              value: infrakitchen
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: infrakitchen-secrets
                  key: postgres-password
            - name: BROKER_URL
              value: <RabbitMQ_URL>
              # example value: amqp://guest:password@infrakitchen-rabbitmq:5672
            - name: JWT_KEY
              valueFrom:
                secretKeyRef:
                  name: infrakitchen-secrets
                  key: jwt-secret
            - name: ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: infrakitchen-secrets
                  key: enc-secret
          ports:
            - name: backend
              containerPort: 8080
              protocol: TCP
---
# Ingress for InfraKitchen (NGINX Controller example)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: infrakitchen
  labels:
    app.kubernetes.io/name: infrakitchen
    app.kubernetes.io/instance: infrakitchen
    app.kubernetes.io/component: infrakitchen
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-internal
    ingress.kubernetes.io/rewrite-target: /
    kubernetes.io/ingress.class: nginx
    kubernetes.io/tls-acme: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: 11M
    nginx.ingress.kubernetes.io/proxy-buffer-size: 16k
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/upgrade-proxy: "true"
    nginx.org/client-max-body-size: 10m
spec:
  ingressClassName: "nginx"
  tls:
    - hosts:
      - <HOST_NAME>
      secretName: ik-tls
  rules:
    - host: <HOST_NAME>
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: infrakitchen
                port:
                  number: 8080


```
