import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";

export type RealtimeRow = Record<string, unknown>;

type Options = {
  orderColumn?: string;
  orderAscending?: boolean;
  limit?: number;
  /** When false, skips fetch/subscribe until Supabase auth is ready. */
  enabled?: boolean;
};

/**
 * Initial load + postgres_changes on `public.<table>`. Updates state without manual refresh.
 */
export function useSupabaseRealtimeTable(table: string, options: Options = {}) {
  const enabled = options.enabled !== false;
  const orderColumn = options.orderColumn ?? "id";
  const orderAscending = options.orderAscending ?? false;
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);

  const [rows, setRows] = useState<RealtimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabase();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRows = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!supabase) {
      setRows([]);
      setError("Supabase is not configured (set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY).");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const q = supabase
      .from(table)
      .select("*")
      .order(orderColumn, { ascending: orderAscending })
      .limit(limit);
    const { data, error: e } = await q;
    if (e) {
      setError(e.message);
      setRows([]);
    } else {
      setRows((data as RealtimeRow[]) ?? []);
    }
    setLoading(false);
  }, [enabled, supabase, table, orderColumn, orderAscending, limit]);

  const scheduleRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void fetchRows();
    }, 120);
  }, [fetchRows]);

  useEffect(() => {
    if (enabled) void fetchRows();
  }, [enabled, fetchRows]);

  useEffect(() => {
    if (!enabled || !supabase) return undefined;

    const channel = supabase
      .channel(`public:${table}:changes`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (_payload: RealtimePostgresChangesPayload<RealtimeRow>) => {
          scheduleRefetch();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          setError((prev) => prev || "Realtime channel error — enable Realtime for this table in Supabase (see src/db/supabase_realtime_rls.sql).");
        }
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [enabled, supabase, table, scheduleRefetch]);

  return {
    rows,
    loading,
    error,
    refresh: fetchRows,
    supabase,
    configured: Boolean(supabase),
  };
}
