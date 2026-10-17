import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  roleLoading: boolean;
  roleError: string | null;
  retryAdminVerification: () => void;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAdmin: false,
  roleLoading: true,
  roleError: null,
  retryAdminVerification: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleRetry, setRoleRetry] = useState(0);
  const currentUserId = useRef<string | null>(null);
  const retryAdminVerification = useCallback(() => setRoleRetry((attempt) => attempt + 1), []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        !["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"].includes(
          event,
        )
      ) {
        return;
      }
      const nextUser = session?.user ?? null;
      if (currentUserId.current !== (nextUser?.id ?? null)) {
        currentUserId.current = nextUser?.id ?? null;
        setIsAdmin(false);
        setRoleLoading(Boolean(nextUser));
        setRoleError(null);
      }
      setUser(nextUser);
      setLoading(false);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = user?.id;

  useEffect(() => {
    if (loading) return;
    let active = true;

    if (!userId) {
      setIsAdmin(false);
      setRoleLoading(false);
      setRoleError(null);
      return () => {
        active = false;
      };
    }

    setIsAdmin(false);
    setRoleLoading(true);
    setRoleError(null);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("is_active_admin", {
          _user_id: userId,
        });
        if (!active) return;
        if (error) {
          console.error("Administrator role verification failed:", error);
          setRoleError("Administrator access could not be verified. Please try again.");
          setIsAdmin(false);
        } else {
          setIsAdmin(data === true);
        }
      } catch (error) {
        if (!active) return;
        console.error("Administrator role verification failed:", error);
        setRoleError("Administrator access could not be verified. Please try again.");
        setIsAdmin(false);
      } finally {
        if (active) setRoleLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, loading, roleRetry]);

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, roleLoading, roleError, retryAdminVerification }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthUser = () => useContext(AuthContext);
