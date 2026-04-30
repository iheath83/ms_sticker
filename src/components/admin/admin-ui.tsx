/**
 * Shared design tokens and primitive components for the MS Admin UI.
 * Inspired by Shopify Polaris — clean whites, light gray backgrounds, clear hierarchy.
 */

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

// ─── Tokens ───────────────────────────────────────────────────────────────────

export const T = {
  bg: "#F1F2F3",
  surface: "#FFFFFF",
  border: "#E1E3E5",
  borderSubtle: "#F1F2F3",
  textPrimary: "#202223",
  textSecondary: "#6D7175",
  textDisabled: "#9CA3AF",
  brand: "#0A0E27",
  brandLight: "#E8EAF6",
  success: "#007F5F",
  successBg: "#D4EDDA",
  warning: "#B98900",
  warningBg: "#FFF5CC",
  danger: "#D72C0D",
  dangerBg: "#FBEAE5",
  info: "#1D4ED8",
  infoBg: "#EFF6FF",
  shadow: "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 8px rgba(0,0,0,0.08)",
  radius: 8,
  radiusSm: 6,
  radiusLg: 12,
} as const;

// ─── Topbar ───────────────────────────────────────────────────────────────────

export function AdminTopbar({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: T.surface,
        borderBottom: `1.5px solid ${T.border}`,
        padding: "0 32px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: T.textPrimary,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <span style={{ fontSize: 12, color: T.textSecondary, marginLeft: 8 }}>{subtitle}</span>
        )}
      </div>
      {children && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {children}
        </div>
      )}
    </header>
  );
}

// ─── Page content wrapper ─────────────────────────────────────────────────────

export function AdminPage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <main
      style={{
        padding: "24px 32px",
        background: T.bg,
        minHeight: "calc(100vh - 56px)",
        ...style,
      }}
    >
      {children}
    </main>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function AdminCard({
  children,
  style,
  padding = "20px 24px",
}: {
  children: ReactNode;
  style?: CSSProperties;
  padding?: string;
}) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1.5px solid ${T.border}`,
        borderRadius: T.radiusLg,
        padding,
        boxShadow: T.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

export function AdminTableWrapper({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1.5px solid ${T.border}`,
        borderRadius: T.radiusLg,
        overflow: "hidden",
        boxShadow: T.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function AdminTableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ background: "#F9FAFB", borderBottom: `1.5px solid ${T.border}` }}>
        {cols.map((h, i) => (
          <th
            key={i}
            style={{
              padding: "11px 16px",
              textAlign: "left",
              fontSize: 11,
              fontWeight: 700,
              color: T.textSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function AdminEmptyState({
  icon = "📭",
  title,
  subtitle,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ padding: "60px 32px", textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: T.textSecondary }}>{subtitle}</div>}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "pink";

const BADGE_STYLE: Record<BadgeVariant, { bg: string; color: string; dot: string }> = {
  success: { bg: T.successBg, color: T.success, dot: "#22C55E" },
  warning: { bg: T.warningBg, color: T.warning, dot: "#F59E0B" },
  danger:  { bg: T.dangerBg,  color: T.danger,  dot: "#EF4444" },
  info:    { bg: T.infoBg,    color: T.info,     dot: "#3B82F6" },
  neutral: { bg: "#F3F4F6",   color: "#6B7280",  dot: "#9CA3AF" },
  purple:  { bg: "#EDE9FE",   color: "#5B21B6",  dot: "#8B5CF6" },
  pink:    { bg: "#FCE7F3",   color: "#9D174D",  dot: "#EC4899" },
};

export function StatusBadge({
  label,
  variant = "neutral",
  dot = true,
}: {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
}) {
  const s = BADGE_STYLE[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: s.dot,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

const BTN_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: T.radiusSm,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
  border: "none",
  transition: "opacity 0.15s",
  whiteSpace: "nowrap",
};

type BtnProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  type?: "button" | "submit";
};

export function PrimaryBtn({ children, href, onClick, disabled, style, type = "button" }: BtnProps) {
  const s: CSSProperties = { ...BTN_BASE, background: T.brand, color: "#fff", opacity: disabled ? 0.5 : 1, ...style };
  if (href) return <Link href={href} style={s}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} style={s}>{children}</button>;
}

export function SecondaryBtn({ children, href, onClick, disabled, style, type = "button" }: BtnProps) {
  const s: CSSProperties = { ...BTN_BASE, background: T.surface, color: T.textPrimary, border: `1.5px solid ${T.border}`, opacity: disabled ? 0.5 : 1, ...style };
  if (href) return <Link href={href} style={s}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} style={s}>{children}</button>;
}

export function DangerBtn({ children, onClick, disabled, style, type = "button" }: BtnProps) {
  const s: CSSProperties = { ...BTN_BASE, background: T.dangerBg, color: T.danger, opacity: disabled ? 0.5 : 1, ...style };
  return <button type={type} onClick={onClick} disabled={disabled} style={s}>{children}</button>;
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  sub,
  href,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  accent?: string;
}) {
  const inner = (
    <AdminCard style={{ height: "100%", boxSizing: "border-box" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent ?? T.textPrimary, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 6 }}>{sub}</div>}
    </AdminCard>
  );
  if (href)
    return (
      <Link href={href} style={{ textDecoration: "none", display: "block" }}>
        {inner}
      </Link>
    );
  return inner;
}

// ─── Section title ─────────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: T.textSecondary,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 12,
        marginTop: 0,
      }}
    >
      {children}
    </h2>
  );
}
