"use client";

import { useRef, useState } from "react";

export default function CallWaiter({
  token,
  initialCalled = false,
}: {
  token: string | null;
  initialCalled?: boolean;
}) {
  const [userCalled, setUserCalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlightRef = useRef(false);

  const called = initialCalled || userCalled;

  const call = async () => {
    if (!token || busy || called || inFlightRef.current) return;
    setBusy(true);
    setFailed(false);
    inFlightRef.current = true;

    try {
      const res = await fetch("/api/waiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setUserCalled(true);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  };

  return (
    <button
      onClick={call}
      disabled={busy || called}
      aria-label={called ? "Waiter has been called" : "Call waiter to table"}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm ${
        called
          ? "bg-[#193A2D]/15 text-[#193A2D] border border-[#193A2D]/30"
          : "bg-[#193A2D] text-[#F8F5EF] hover:bg-[#122b21] active:scale-95"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          called ? "bg-amber-500 animate-pulse" : "bg-[#E7B94F]"
        }`}
      />
      {called
        ? "Waiter Notified"
        : busy
        ? "Calling..."
        : failed
        ? "Retry Call"
        : "Call Waiter"}
    </button>
  );
}
