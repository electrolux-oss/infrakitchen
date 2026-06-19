/** Raw Kubernetes pod shape returned by the GraphQL deployment-pods query. */
export interface K8sPod {
  metadata: {
    name: string;
    uid: string;
    labels: Record<string, string>;
    annotations?: Record<string, string>;
    creation_timestamp: string;
  };
  status: {
    phase: string;
  };
  spec: {
    containers: { name: string; image: string }[];
  };
}
