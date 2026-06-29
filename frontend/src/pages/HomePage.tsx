export function HomePage() {
  return (
    <section className="home-page">
      <h1>Applications</h1>
      <p className="home-page__lead">
        Select an application to manage discovery, assets, and data products. The
        console is organized around your applications—not underlying technologies.
      </p>
      <div className="home-page__placeholder" role="status">
        <p>No applications yet.</p>
        <p className="home-page__hint">
          Application list and workspace navigation will appear here in upcoming
          sprints.
        </p>
      </div>
    </section>
  );
}
