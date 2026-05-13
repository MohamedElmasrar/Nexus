"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/api";

interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
        });

        if (!isMounted) {
          return;
        }

        if (!res.ok) {
          setIsLoggedIn(false);
          setUser(null);
          return;
        }

        const data = await res.json();
        setIsLoggedIn(Boolean(data.authenticated));
        setUser(data.user ?? null);
      } catch {
        if (isMounted) {
          setIsLoggedIn(false);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void checkSession();

    // Listen for 401s from the API proxy
    const handleAuthExpired = () => {
      // Don't call logout directly as it's async and depends on router,
      // instead just make the fetch call to clear the cookie and redirect
      void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
        setIsLoggedIn(false);
        setUser(null);
        router.push("/login");
      });
    };

    window.addEventListener("nexus-auth-expired", handleAuthExpired);

    return () => {
      isMounted = false;
      window.removeEventListener("nexus-auth-expired", handleAuthExpired);
    };
  }, [router]);

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        if (res.ok) {
          // Fetch user info after login
          const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
          let loggedInUser: User | null = null;
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            loggedInUser = sessionData.user ?? null;
            setUser(loggedInUser);
          }

          setIsLoggedIn(true);

          // All users go to /dashboard, admins access admin panel from sidebar
          router.push("/dashboard");
          return true;
        }

        return false;
      } catch (error) {
        console.error("Login failed:", error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setIsLoggedIn(false);
      setUser(null);
      router.push("/login");
      setIsLoading(false);
    }
  }, [router]);

  return {
    isLoggedIn,
    isLoading,
    user,
    login,
    logout,
  };
}
