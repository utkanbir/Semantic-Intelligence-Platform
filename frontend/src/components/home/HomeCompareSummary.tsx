export function HomeCompareSummary() {
  return (
    <section
      className="home-compare"
      aria-labelledby="home-compare-heading"
      aria-describedby="home-compare-empty"
    >
      <h2 id="home-compare-heading" className="home-compare__title">
        Compare dashboard özeti
      </h2>
      <div className="home-compare__metrics">
        <div className="home-compare__metric">
          <span className="home-compare__metric-label">Genel mismatch oranı</span>
          <span className="home-compare__metric-value home-compare__metric-value--muted">
            —
          </span>
        </div>
        <div className="home-compare__metric">
          <span className="home-compare__metric-label">Geçen haftaya göre</span>
          <span className="home-compare__metric-value home-compare__metric-value--muted">
            —
          </span>
        </div>
        <div className="home-compare__metric">
          <span className="home-compare__metric-label">En çok mismatch</span>
          <span className="home-compare__metric-value home-compare__metric-value--muted">
            —
          </span>
        </div>
      </div>
      <p id="home-compare-empty" className="home-compare__hint">
        Compare Mode verisi henüz yok — özet Sprint 47+ ile doldurulacak (F2).
      </p>
    </section>
  );
}
