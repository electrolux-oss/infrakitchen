import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { jwtDecode } from "jwt-decode";

import inMemoryToken from "./inMemoryToken";
import { refreshAuth } from "./refreshToken";
import { User, AuthContextType } from "./types";

interface UserResponse {
  id: string;
  identifier?: string;
  display_name?: string;
  first_name: string;
  last_name: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Helper function to process the user data from a token.
  const processToken = useCallback(async () => {
    await refreshAuth()
      .then(() => {
        const token = inMemoryToken.getToken();

        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }

        try {
          const decoded_token: any = jwtDecode(token);
          const userPayload = decoded_token.pld as UserResponse;
          const formattedUser: User = {
            id: userPayload.id,
            identifier:
              userPayload.identifier ||
              userPayload.display_name ||
              `${userPayload.first_name} ${userPayload.last_name}`,
          };
          setUser(formattedUser);
        } catch (_) {
          // If decoding fails, clear the token and user state.
          inMemoryToken.setToken("");
          setUser(null);
        } finally {
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }, [setUser, setLoading]);

  useEffect(() => {
    // Process the token once on mount.
    processToken();
  }, [processToken]);

  const login = async (provider: string) => {
    const redirectPath = location.search.split("redirect=")[1];
    if (redirectPath) {
      localStorage.setItem("redirectPath", decodeURIComponent(redirectPath));
    }

    let loginUrl: string = "";
    let loginRedirectUri: string = "";
    if (provider === "microsoft") {
      loginRedirectUri = "/api/auth/microsoft/callback";
      loginUrl = `/api/auth/microsoft/login?redirect_uri=${encodeURIComponent(loginRedirectUri)}`;
    } else if (provider === "guest_default") {
      loginRedirectUri = "/api/auth/guest/callback/default";
      loginUrl = `/api/auth/guest/login/default?redirect_uri=${encodeURIComponent(loginRedirectUri)}`;
    } else if (provider === "guest_super") {
      loginRedirectUri = "/api/auth/guest/callback/super";
      loginUrl = `/api/auth/guest/login/super?redirect_uri=${encodeURIComponent(loginRedirectUri)}`;
    } else if (provider === "guest_infra") {
      loginRedirectUri = "/api/auth/guest/callback/infra";
      loginUrl = `/api/auth/guest/login/infra?redirect_uri=${encodeURIComponent(loginRedirectUri)}`;
    } else if (provider === "github") {
      loginRedirectUri = "/api/auth/github/callback";
      loginUrl = `/api/auth/github/login?redirect_uri=${encodeURIComponent(loginRedirectUri)}`;
    }
    if (loginUrl) {
      window.location.href = loginUrl;
    }

    return new Promise<void>(() => {});
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "GET" });
    inMemoryToken.setToken("");
    setUser(null);
    return Promise.resolve();
  };

  const value: AuthContextType = { user, login, logout, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
