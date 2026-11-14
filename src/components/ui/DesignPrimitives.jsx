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
