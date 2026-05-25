export type AuditRiskLevel = "normal" | "warning" | "critical";
export type AuditCategory = "security" | "payments" | "users" | "bookings" | "admin";

export type AuditEventRow = {
  id: string;
  user: string;
  email?: string | null;
  role: string;
  action: string;
  actionKey: string;
  category: AuditCategory;
  timestamp: string | null;
  ip: string;
  device: string;
  riskLevel: AuditRiskLevel;
  detail?: string | null;
};

export type AuditSummary = {
  activeAdmins: number;
  failedLogins: number;
  pendingInvites: number;
  suspiciousActivity: number;
  activeShops: number;
};

export type AuditTimeFilter = "today" | "7d" | "30d";
export type AuditCategoryFilter = "all" | AuditCategory;

export const MOCK_AUDIT_EVENTS: AuditEventRow[] = [
  {
    id: "audit-001",
    user: "Platform Admin",
    email: "service@ifcdc.org",
    role: "super_admin",
    action: "User login",
    actionKey: "login_success",
    category: "security",
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    ip: "192.168.1.44",
    device: "IFCDC mobile app",
    riskLevel: "normal",
  },
  {
    id: "audit-002",
    user: "Unknown actor",
    email: "intruder@example.com",
    role: "—",
    action: "Failed login attempt",
    actionKey: "login_failed",
    category: "security",
    timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    ip: "203.0.113.18",
    device: "Unknown device",
    riskLevel: "critical",
    detail: "3 consecutive failures",
  },
  {
    id: "audit-003",
    user: "Platform Admin",
    email: "admin@example.com",
    role: "admin",
    action: "Role changed",
    actionKey: "role_change",
    category: "users",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    ip: "10.0.0.12",
    device: "macOS",
    riskLevel: "warning",
    detail: "Barber → Shop Owner",
  },
  {
    id: "audit-004",
    user: "Platform Admin",
    email: "service@ifcdc.org",
    role: "super_admin",
    action: "Invitation sent",
    actionKey: "invite_sent",
    category: "users",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    ip: "192.168.1.44",
    device: "IFCDC mobile app",
    riskLevel: "normal",
    detail: "newbarber@ifcdc.org",
  },
  {
    id: "audit-005",
    user: "Customer",
    email: "customer@example.com",
    role: "user",
    action: "Password reset requested",
    actionKey: "password_reset_request",
    category: "security",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    ip: "172.16.0.8",
    device: "iOS device",
    riskLevel: "warning",
  },
  {
    id: "audit-006",
    user: "Platform Admin",
    email: "service@ifcdc.org",
    role: "super_admin",
    action: "Account suspended",
    actionKey: "account_suspended",
    category: "users",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
    ip: "192.168.1.44",
    device: "IFCDC mobile app",
    riskLevel: "critical",
    detail: "suspended@example.com",
  },
  {
    id: "audit-007",
    user: "Shop Owner",
    email: "owner@example.com",
    role: "shop_owner",
    action: "Booking override",
    actionKey: "booking_override",
    category: "bookings",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    ip: "10.0.0.22",
    device: "Android device",
    riskLevel: "warning",
    detail: "Manual slot assignment",
  },
  {
    id: "audit-008",
    user: "IFCDC Platform",
    email: "service@ifcdc.org",
    role: "super_admin",
    action: "Payment captured",
    actionKey: "payment_capture",
    category: "payments",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    ip: "—",
    device: "PayPal webhook",
    riskLevel: "normal",
    detail: "$24.99 booking deposit",
  },
  {
    id: "audit-009",
    user: "Platform Admin",
    email: "admin@example.com",
    role: "admin",
    action: "Admin settings changed",
    actionKey: "admin_change",
    category: "admin",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    ip: "10.0.0.12",
    device: "macOS",
    riskLevel: "warning",
    detail: "Notification policy updated",
  },
  {
    id: "audit-010",
    user: "Unknown actor",
    email: "—",
    role: "—",
    action: "Suspicious activity flagged",
    actionKey: "suspicious_activity",
    category: "security",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    ip: "198.51.100.9",
    device: "Unknown device",
    riskLevel: "critical",
    detail: "Rapid role escalation attempt blocked",
  },
];

export const MOCK_AUDIT_SUMMARY: AuditSummary = {
  activeAdmins: 2,
  failedLogins: 3,
  pendingInvites: 2,
  suspiciousActivity: 1,
  activeShops: 2,
};

export function daysForFilter(filter: AuditTimeFilter): number {
  if (filter === "today") return 1;
  if (filter === "30d") return 30;
  return 7;
}

export function filterEventsByTime(events: AuditEventRow[], filter: AuditTimeFilter): AuditEventRow[] {
  const days = daysForFilter(filter);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return events.filter((e) => {
    if (!e.timestamp) return true;
    const t = new Date(e.timestamp).getTime();
    return Number.isNaN(t) || t >= cutoff;
  });
}

export function filterEventsByCategory(events: AuditEventRow[], category: AuditCategoryFilter): AuditEventRow[] {
  if (category === "all") return events;
  return events.filter((e) => e.category === category);
}

export function buildAuditCsv(events: AuditEventRow[]): string {
  const header = "timestamp,user,email,role,action,category,risk,ip,device,detail";
  const rows = events.map((e) =>
    [
      e.timestamp || "",
      e.user,
      e.email || "",
      e.role,
      e.action,
      e.category,
      e.riskLevel,
      e.ip,
      e.device,
      (e.detail || "").replace(/,/g, ";"),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header, ...rows].join("\n");
}
