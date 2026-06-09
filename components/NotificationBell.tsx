"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { getProfileId } from "@/lib/local-profile";
import { getProfileByWalletAddress } from "@/lib/profile";
import { getNotifications, getUnreadCount, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/notifications";
import type { AppNotification } from "@/lib/types";

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const router = useRouter();
  const { address } = useAccount();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const cached = getProfileId(address);
    if (cached) {
      setProfileId(cached);
    } else if (address) {
      getProfileByWalletAddress(address).then((p) => {
        if (p?.id) setProfileId(p.id);
      }).catch(() => {});
    }
  }, [address]);

  const fetchData = useCallback(async () => {
    if (!profileId) return;
    const [count, list] = await Promise.all([
      getUnreadCount(profileId),
      getNotifications(profileId, 30),
    ]);
    setUnreadCount(count);
    setNotifications(list);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    void fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [profileId, fetchData]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [open, fetchData]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        open &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleToggle = () => setOpen((prev) => !prev);

  const handleMarkRead = async (n: AppNotification) => {
    if (!profileId) return;
    await markNotificationAsRead(profileId, n.id);
    setNotifications((prev) => prev.map((p) => (p.id === n.id ? { ...p, read: true } : p)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    if (!profileId) return;
    await markAllNotificationsAsRead(profileId);
    setNotifications((prev) => prev.map((p) => ({ ...p, read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.read && profileId) {
      void markNotificationAsRead(profileId, n.id);
      setNotifications((prev) => prev.map((p) => (p.id === n.id ? { ...p, read: true } : p)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);
    router.push(`/group/${n.groupId}`);
  };

  if (!profileId) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        title="Notifications"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          transition: "background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease",
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 13 21.7295C12.6981 21.9044 12.3573 21.9965 12 21.9965C11.6427 21.9965 11.3019 21.9044 11 21.7295C10.6981 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              background: "var(--red)",
              color: "#fff",
              fontSize: "0.625rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              lineHeight: 1,
              boxShadow: "0 0 0 2px var(--surface-2)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="animate-scale-in"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 360,
            maxWidth: "calc(100vw - 2rem)",
            maxHeight: "min(480px, calc(100vh - 100px))",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{ border: "none", background: "none", color: "var(--blue)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, padding: 0, fontFamily: "DM Sans, sans-serif" }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <div className="spinner" style={{ margin: "0 auto" }} />
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "3rem 2rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem", opacity: 0.4 }}>🔔</div>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>No notifications yet</p>
              </div>
            ) : (
              <div>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      padding: "0.75rem 1.25rem",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      background: n.read ? "transparent" : "var(--blue-light)",
                      borderBottom: "1px solid var(--border)",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = n.read ? "transparent" : "var(--blue-light)";
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.read ? "transparent" : "var(--blue)", flexShrink: 0, marginTop: "0.375rem" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.8125rem", fontWeight: n.read ? 400 : 600, color: "var(--text)", lineHeight: 1.4 }}>
                        {n.message}
                      </p>
                      <p style={{ fontSize: "0.6875rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
                        {n.groupName} · {formatTime(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleMarkRead(n);
                        }}
                        style={{ border: "none", background: "none", color: "var(--text-3)", cursor: "pointer", fontSize: "0.75rem", padding: "0.125rem 0.25rem", flexShrink: 0, fontFamily: "DM Sans, sans-serif" }}
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}