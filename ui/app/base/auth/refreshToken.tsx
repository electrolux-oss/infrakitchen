import inMemoryToken from "./inMemoryToken";

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
        const response = await fetch("/api/auth/refresh");
        if (!response.ok) {
          throw new Error("Failed to refresh token");
        }

        const tokens = await response.json();
        const newToken = tokens.token;

        // Store the new token
        inMemoryToken.setToken(newToken);

        return newToken;
      } catch (_) {
        // Handle refresh failure
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
