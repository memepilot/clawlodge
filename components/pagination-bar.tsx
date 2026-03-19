import Link from "next/link";

type PaginationBarProps = {
  labels: {
    showing: string;
    previous: string;
    next: string;
    page: string;
    jumpTo: string;
    go: string;
  };
  result: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_prev: boolean;
    has_next: boolean;
  };
  buildPageHref: (page: number) => string;
  action: string;
  hiddenFields?: Array<{ name: string; value: string }>;
  inputId?: string;
};

export function PaginationBar({
  labels,
  result,
  buildPageHref,
  action,
  hiddenFields = [],
  inputId = "page-jump",
}: PaginationBarProps) {
  if (result.total_pages <= 1) return null;

  return (
    <div className="pagination-bar">
      <p className="pagination-summary muted">
        {labels.showing} {(result.page - 1) * result.per_page + 1}-{Math.min(result.page * result.per_page, result.total)} / {result.total}
      </p>
      <div className="pagination-actions">
        {result.has_prev ? (
          <Link className="btn" href={buildPageHref(result.page - 1)}>
            {labels.previous}
          </Link>
        ) : (
          <span className="btn pagination-disabled" aria-disabled="true">
            {labels.previous}
          </span>
        )}
        <span className="pagination-current">
          {labels.page} {result.page} / {result.total_pages}
        </span>
        <form className="pagination-jump" method="get" action={action}>
          {hiddenFields.map((field) => (
            <input key={`${field.name}:${field.value}`} type="hidden" name={field.name} value={field.value} />
          ))}
          <label className="pagination-jump-label" htmlFor={inputId}>
            {labels.jumpTo}
          </label>
          <input
            id={inputId}
            className="pagination-jump-input"
            type="number"
            name="page"
            min={1}
            max={result.total_pages}
            defaultValue={result.page}
            inputMode="numeric"
          />
          <button className="btn pagination-jump-button" type="submit">
            {labels.go}
          </button>
        </form>
        {result.has_next ? (
          <Link className="btn btn-primary" href={buildPageHref(result.page + 1)}>
            {labels.next}
          </Link>
        ) : (
          <span className="btn btn-primary pagination-disabled" aria-disabled="true">
            {labels.next}
          </span>
        )}
      </div>
    </div>
  );
}
