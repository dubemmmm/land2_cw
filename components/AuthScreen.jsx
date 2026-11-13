import Link from "next/link";

// The centred panel shared by sign in, sign up and the password pages.
export default function AuthScreen({ title, lede, wide = false, children, foot }) {
  return (
    <main className="auth-screen">
      <section className={`auth-panel ${wide ? "auth-panel-wide" : ""}`}>
        <Link className="auth-brand" href="/" aria-label="Squaremeter by CW home">
          <span className="cw-mark">CW</span>
          <span>Squaremeter <small>by CW</small></span>
        </Link>
        <div className="auth-heading">
          <h1>{title}</h1>
          {lede ? <p>{lede}</p> : null}
        </div>
        {children}
        {foot ? <div className="auth-foot">{foot}</div> : null}
      </section>
    </main>
  );
}
