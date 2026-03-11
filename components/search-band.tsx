type SearchBandProps = {
  action?: string;
  defaultQuery?: string;
  placeholder: string;
  buttonLabel: string;
  helperText?: string;
  sortValue?: "hot" | "new";
  includeSort?: boolean;
  hiddenTag?: string;
  className?: string;
};

export function SearchBand({
  action = "/",
  defaultQuery = "",
  placeholder,
  buttonLabel,
  helperText,
  sortValue = "hot",
  includeSort = false,
  hiddenTag,
  className = "",
}: SearchBandProps) {
  const rootClassName = ["hero-search-band", "shell", className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      {helperText ? (
        <div className="hero-search-meta">
          <div className="stat">{helperText}</div>
        </div>
      ) : null}
      <form className="search-stack" method="get" action={action}>
        <div className="search-primary-row">
          <div className="search-bar">
            <span className="mono">/</span>
            <input className="search-input" name="q" defaultValue={defaultQuery} placeholder={placeholder} />
          </div>
          <button className="btn btn-primary search-submit" type="submit">
            {buttonLabel}
          </button>
        </div>
        {includeSort ? (
          <div className="search-controls-row">
            <select className="select" defaultValue={sortValue} name="sort">
              <option value="hot">Hot</option>
              <option value="new">New</option>
            </select>
            {hiddenTag?.trim() ? <input type="hidden" name="tag" value={hiddenTag.trim()} /> : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
