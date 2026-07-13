export default function AppLoading() {
  return (
    <div className="page-loading" role="status" aria-label="Seite wird geladen">
      <div className="loading-line short" />
      <div className="loading-line title" />
      <div className="loading-line medium" />
      <div className="loading-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="loading-card" key={index} />
        ))}
      </div>
      <span className="sr-only">Inhalt wird geladen…</span>
    </div>
  );
}
