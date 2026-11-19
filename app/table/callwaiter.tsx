"use client";

import { useRef, useState } from "react";
import { BellIcon, CheckIcon } from "@/components/ui/icons";

export default function CallWaiter({
  token,
  initialCalled = false,
}: {
  token: string | null;
  initialCalled?: boolean;
}) {
  const [userCalled, setUserCalled] = useState(false);
  const [prevInitialCalled, setPrevInitialCalled] = useState(initialCalled);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlightRef = useRef(false);

  // When staff acknowledges and closes the call, re-enable the button without cascading effect renders
  if (initialCalled !== prevInitialCalled) {
    setPrevInitialCalled(initialCalled);
    if (!initialCalled) {
      setUserCalled(false);
    }
  }

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
      aria-label={called ? "Waitstaff has been notified" : "Call waitstaff to table"}
      className={`inline-flex items-center gap-1.5 min-h-[36px] rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer shadow-xs select-none ${
        called
          ? "bg-[#E8B95B]/25 text-[#E8B95B] border border-[#E8B95B]/60 shadow-xs cursor-default font-bold"
          : failed
          ? "bg-rose-900/60 text-rose-200 border border-rose-400 active:scale-95"
          : busy
          ? "bg-white/10 text-white/70 border border-white/20 cursor-wait"
          : "bg-white/10 text-[#FAF7F0] hover:bg-white/20 hover:text-[#E8B95B] border border-white/25 active:scale-95 backdrop-blur-xs"
      }`}
    >
      {called ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E8B95B] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E8B95B]" />
          </span>
          <CheckIcon className="w-3.5 h-3.5 text-[#E8B95B]" />
          <span>Staff Alerted</span>
        </>
      ) : busy ? (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Calling...</span>
        </>
      ) : (
        <>
          <BellIcon className="w-3.5 h-3.5 text-[#E8B95B] shrink-0" />
          <span>{failed ? "Retry Call" : "Call Staff"}</span>
        </>
      )}
    </button>
  );
}
