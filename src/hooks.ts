import { useCallback, useEffect, useState } from "react";
import { getSession, onAuthChange } from "./services/auth";
import type { Session } from "./types";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    getSession().then((s) => { setSession(s); setLoading(false); });
  }, []);

  useEffect(() => {
    refresh();
    return onAuthChange(refresh);
  }, [refresh]);

  return { session, loading, refresh };
}
