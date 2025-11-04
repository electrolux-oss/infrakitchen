# Kubernetes

InfraKitchen provides Kubernetes integration for managing containerized applications and infrastructure workflows. This allows you to deploy, scale, and operate InfraKitchen components directly on your Kubernetes cluster.

## 🚀 Key Features

- Deploy InfraKitchen backend, scheduler, and worker as Kubernetes Deployments.
- Use Kubernetes Secrets to securely manage sensitive configuration (JWT, encryption keys, database passwords).
- Integrate with existing PostgreSQL and RabbitMQ services.
- Expose InfraKitchen via Kubernetes Service and Ingress for internal or external access.
- Scale components independently using native Kubernetes controls.

## 🏁 Getting Started

For step-by-step deployment instructions, see the [Getting Started: Kubernetes Deployment](../getting-started/deployment/kubernetes.md) page.

## 💡 Best Practices

- Use resource limits and requests to optimize scheduling and reliability.
- Store secrets securely and rotate them as needed.
- Monitor health and logs using Kubernetes probes and logging tools.
- Use Ingress with TLS for secure access.

---

Kubernetes integration makes it easy to run InfraKitchen in modern cloud-native environments, leveraging the power and flexibility of container orchestration.
