import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  roleLoading: boolean;
  roleError: string | null;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAdmin: false,
  roleLoading: true,
  roleError: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let roleRequest = 0;

    function updateUser(nextUser: User | null) {
      const request = ++roleRequest;
      setUser(nextUser);
      setLoading(false);
      setRoleError(null);

      if (!nextUser) {
        setIsAdmin(false);
        setRoleLoading(false);
        return;
      }

      setIsAdmin(false);
      setRoleLoading(true);
      queueMicrotask(() => {
        void (async () => {
          try {
            const { data, error } = await supabase.rpc("is_active_admin", {
              _user_id: nextUser.id,
            });
            if (!active || request !== roleRequest) return;
            if (error) {
              console.error("Administrator role verification failed:", error);
              setRoleError("Administrator access could not be verified. Please try again.");
              setIsAdmin(false);
            } else {
              setIsAdmin(data === true);
            }
            setRoleLoading(false);
          } catch (error) {
            if (!active || request !== roleRequest) return;
            console.error("Administrator role verification failed:", error);
            setRoleError("Administrator access could not be verified. Please try again.");
            setIsAdmin(false);
            setRoleLoading(false);
          }
        })();
      });
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        ["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"].includes(
          event,
        )
      ) {
        updateUser(session?.user ?? null);
      }
    });

    void (async () => {
      try {
        const { data: result, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error) {
          console.error("Could not restore the authenticated user:", error);
          setLoading(false);
          setRoleLoading(false);
          return;
        }
        updateUser(result.user);
      } catch (error) {
        if (!active) return;
        console.error("Could not restore the authenticated user:", error);
        setLoading(false);
        setRoleLoading(false);
      }
    })();

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, roleLoading, roleError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthUser = () => useContext(AuthContext);
