import "./design-primitives.css";

export function PageHeading({ eyebrow, title, description, actions }) {
  return <header className="cyb-page-heading">
    <div><span>{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="cyb-page-heading-actions">{actions}</div>}
  </header>;
}

export function EmptyState({ icon = "✳", title, description, action }) {
  return <section className="cyb-empty-state" aria-label={title}>
    <span className="cyb-empty-state-icon" aria-hidden="true">{icon}</span>
    <h2>{title}</h2><p>{description}</p>
    {action && <div className="cyb-empty-state-action">{action}</div>}
  </section>;
}

export function StatusBadge({ children, tone = "neutral" }) {
  return <span className={`cyb-status-badge cyb-status-badge--${tone}`}>{children}</span>;
}

export function InlineState({ kind = "empty", title, description, onRetry }) {
  const isLoading = kind === "loading";
  const isError = kind === "error";
  return <section className={`cyb-inline-state cyb-inline-state--${kind}`} role={isLoading ? "status" : isError ? "alert" : undefined} aria-live={isLoading ? "polite" : undefined}>
    <span className={isLoading ? "cyb-inline-state-spinner" : "cyb-inline-state-mark"} aria-hidden="true">{isLoading ? "" : isError ? "!" : "✳"}</span>
    <div><strong>{title}</strong><p>{description}</p></div>
    {isError && onRetry && <button type="button" onClick={onRetry}>Try again</button>}
  </section>;
}
