/** @public */
export interface InfraKitchenApi {
  getToken: () => Promise<string | null>;
  graphqlRequest: <T>(
    query: string,
    variables?: Record<string, any>,
  ) => Promise<T>;
}
