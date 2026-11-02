# The worker container (the first one) inherits the image and the InfraKitchen settings
# (database, keys, ...) of the InfraKitchen pod, so they are not repeated here.
# Set ``image`` or ``env`` entries in the template to override them.
DEFAULT_POD_MANIFEST = """\
apiVersion: v1
kind: Pod
metadata:
  labels:
    app.kubernetes.io/name: infrakitchen
    app.kubernetes.io/component: infrakitchen-worker
spec:
  # serviceAccountName: <SERVICE_ACCOUNT_NAME>
  containers:
    - name: infrakitchen-worker
      imagePullPolicy: IfNotPresent
      command:
        - /app/.venv/bin/python
        - worker.py
      resources:
        requests:
          cpu: 500m
          memory: 512Mi
        limits:
          cpu: 2000m
          memory: 2048Mi
"""
