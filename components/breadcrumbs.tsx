import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="detail-breadcrumbs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="detail-breadcrumb-item">
            {item.href && !isLast ? (
              <Link className="inline-link" href={item.href}>
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
            {!isLast ? <span className="detail-breadcrumb-separator">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
