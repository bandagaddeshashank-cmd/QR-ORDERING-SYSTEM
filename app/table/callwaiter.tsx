"use client";

import { useCallback, useEffect, useState } from "react";

export default function CallWaiter({ token }: { token: string | null }) {
  const [called, setCalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/waiter?t=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      if (res.ok) setCalled((await res.json()).called);
    } catch {
      // ignore, the next check will retry
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const call = async () => {
    if (!token || busy || called) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/waiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) setCalled(true);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={call}
      disabled={busy || called}
      className={`rounded-full border-2 border-[#14511D] px-3 py-1 text-sm font-semibold ${
        called ? "text-[#14511D]" : "bg-[#14511D] text-[#FFF4C2]"
      }`}
    >
      {called
        ? "Waiter is on the way"
        : busy
        ? "Calling"
        : failed
        ? "Try again"
        : "Call waiter"}
    </button>
  );
}