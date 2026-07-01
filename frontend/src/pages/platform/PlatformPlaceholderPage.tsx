interface PlatformPlaceholderPageProps {
  title: string;
  description: string;
}

export function PlatformPlaceholderPage({
  title,
  description,
}: PlatformPlaceholderPageProps) {
  return (
    <section className="platform-page">
      <h1>{title}</h1>
      <p className="platform-page__lead">{description}</p>
      <div className="platform-page__placeholder" role="status">
        <p>Content will be available in a future release.</p>
      </div>
    </section>
  );
}
