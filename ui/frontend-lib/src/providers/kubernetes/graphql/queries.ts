export const KUBERNETES_NAMESPACES_QUERY = `
  query KubernetesNamespaces($k8sService: String!, $resourceId: String!) {
    kubernetesNamespaces(k8sService: $k8sService, resourceId: $resourceId)
  }
`;

export const KUBERNETES_DEPLOYMENTS_QUERY = `
  query KubernetesDeployments($k8sService: String!, $resourceId: String!, $namespace: String!) {
    kubernetesDeployments(k8sService: $k8sService, resourceId: $resourceId, namespace: $namespace)
  }
`;

export const KUBERNETES_PODS_QUERY = `
  query KubernetesPods($k8sService: String!, $resourceId: String!, $namespace: String!) {
    kubernetesPods(k8sService: $k8sService, resourceId: $resourceId, namespace: $namespace)
  }
`;

export const KUBERNETES_SERVICES_QUERY = `
  query KubernetesServices($k8sService: String!, $resourceId: String!, $namespace: String!) {
    kubernetesServices(k8sService: $k8sService, resourceId: $resourceId, namespace: $namespace)
  }
`;

export const KUBERNETES_DEPLOYMENT_PODS_QUERY = `
  query KubernetesDeploymentPods(
    $k8sService: String!, $resourceId: String!, $namespace: String!, $deploymentName: String!
  ) {
    kubernetesDeploymentPods(
      k8sService: $k8sService, resourceId: $resourceId,
      namespace: $namespace, deploymentName: $deploymentName
    )
  }
`;

export const DELETE_KUBERNETES_POD_MUTATION = `
  mutation DeleteKubernetesPod(
    $k8sService: String!, $resourceId: String!, $namespace: String!, $podName: String!
  ) {
    deleteKubernetesPod(
      k8sService: $k8sService, resourceId: $resourceId,
      namespace: $namespace, podName: $podName
    )
  }
`;

export const RESTART_KUBERNETES_DEPLOYMENT_MUTATION = `
  mutation RestartKubernetesDeployment(
    $k8sService: String!, $resourceId: String!, $namespace: String!, $deploymentName: String!
  ) {
    restartKubernetesDeployment(
      k8sService: $k8sService, resourceId: $resourceId,
      namespace: $namespace, deploymentName: $deploymentName
    )
  }
`;
