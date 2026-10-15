import inMemoryToken from "./inMemoryToken";

const REFRESH_AUTH_TOKEN_MUTATION = `
  mutation RefreshAuthToken {
    refreshAuthToken {
      token
    }
  }
`;

class AuthTokenRefresher {
  private refreshPromise: Promise<string> | null = null;

  public async refreshAuthTokens(): Promise<string> {
    // If there's already a refresh in progress, return the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Create new refresh promise
    this.refreshPromise = (async () => {
      try {
        const response = await fetch("/api/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: REFRESH_AUTH_TOKEN_MUTATION }),
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error("Failed to refresh token");
        }

        const payload = await response.json();
        if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
          throw new Error(
            payload.errors[0]?.message || "Failed to refresh token",
          );
        }

        const newToken = payload?.data?.refreshAuthToken?.token;
        if (!newToken) {
          throw new Error("Failed to refresh token");
        }

        // Store the new token
        inMemoryToken.setToken(newToken);

        return newToken;
      } finally {
        // Clear the promise so subsequent calls can try again
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

// Create a singleton instance
const tokenRefresher = new AuthTokenRefresher();

export const refreshAuth = async () => {
  const accessToken: any = inMemoryToken.getDecodedToken();

  if (!accessToken || accessToken.exp < Date.now() / 1000) {
    try {
      await tokenRefresher.refreshAuthTokens();
      return Promise.resolve();
    } catch (error) {
      // Handle authentication failure
      return Promise.reject(error);
    }
  }
  return Promise.resolve();
};
