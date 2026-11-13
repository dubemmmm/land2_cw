import Link from "next/link";

// Page head set as a drawing-sheet title block.
// crumbs: [{ href?, label }], cells: [{ label, value }]
export default function TitleBlock({ crumbs = [], title, lede, actions, cells = [], as: Heading = "h1" }) {
  return (
    <header className="sq-pagehead">
      {crumbs.length ? (
        <nav className="cw-crumbs" aria-label="Breadcrumb">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} style={{ display: "contents" }}>
              {index ? <span aria-hidden="true">/</span> : null}
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="sq-pagehead-main">
        <div>
          <Heading className="cw-pagehead-title">{title}</Heading>
          {lede ? <p>{lede}</p> : null}
        </div>
        {actions ? <div className="sq-pagehead-actions">{actions}</div> : null}
      </div>
      {cells.length ? (
        <dl className="sq-titleblock">
          {cells.map((cell) => (
            <div key={cell.label}>
              <dt>{cell.label}</dt>
              <dd>{cell.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}
