// Shared card container for all auth pages — Server Component safe

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--white)",
        border: "2px solid var(--ink)",
        borderRadius: "var(--r-lg)",
        boxShadow: "6px 6px 0 0 var(--ink)",
        padding: "40px 36px",
        width: "100%",
        maxWidth: 420,
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 28,
            fontFamily: "var(--font-archivo), system-ui, sans-serif",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: "var(--grey-600)", lineHeight: 1.5 }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function AuthInput({
  label,
  id,
  type = "text",
  name,
  placeholder,
  autoComplete,
  required,
  error,
}: {
  label: string;
  id: string;
  type?: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  error?: string | undefined;
}) {
  return (
    <div style={{ marginBottom: error ? 4 : 16 }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 6,
          letterSpacing: "0.04em",
          color: "var(--ink)",
        }}
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        style={{
          width: "100%",
          padding: "10px 14px",
          border: `1.5px solid ${error ? "var(--red)" : "var(--grey-200)"}`,
          borderRadius: "var(--r)",
          fontSize: 14,
          fontFamily: "var(--font-archivo), monospace",
          background: "var(--white)",
          color: "var(--ink)",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      {error && (
        <p style={{ fontSize: 11, color: "var(--red)", marginTop: 4, fontWeight: 500 }}>{error}</p>
      )}
    </div>
  );
}

export function AuthSubmitButton({ label, loading }: { label: string; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: "100%",
        padding: "13px",
        background: loading ? "var(--grey-200)" : "var(--blue)",
        color: loading ? "var(--grey-400)" : "var(--white)",
        border: "2px solid var(--ink)",
        borderRadius: "var(--r)",
        fontSize: 14,
        fontWeight: 700,
        fontFamily: "var(--font-archivo), monospace",
        cursor: loading ? "not-allowed" : "pointer",
        letterSpacing: "0.04em",
        transition: "background 0.1s",
      }}
    >
      {loading ? "…" : label}
    </button>
  );
}

export function AuthError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <div
      style={{
        background: "#FEF2F2",
        border: "1.5px solid var(--red)",
        borderRadius: "var(--r)",
        padding: "10px 14px",
        fontSize: 13,
        color: "var(--red)",
        fontWeight: 500,
        marginBottom: 16,
      }}
    >
      {message}
    </div>
  );
}

export function AuthSuccess({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <div
      style={{
        background: "#F0FDF4",
        border: "1.5px solid #16A34A",
        borderRadius: "var(--r)",
        padding: "10px 14px",
        fontSize: 13,
        color: "#15803D",
        fontWeight: 500,
        marginBottom: 16,
      }}
    >
      {message}
    </div>
  );
}
