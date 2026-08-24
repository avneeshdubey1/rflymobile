// Reusable skeleton loading placeholders.
// Import what you need wherever data is being fetched.

export function SkeletonBlock({ width, height, radius = 4, style = {} }) {
  return (
    <span
      className="skeleton-block"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function SkeletonRow({ count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div className="data-row skeleton-row" key={i}>
          <div className="data-row__main">
            <SkeletonBlock width={140} height={14} style={{ marginBottom: 6 }} />
            <SkeletonBlock width={100} height={12} style={{ marginBottom: 6 }} />
            <SkeletonBlock width={60} height={18} radius={10} />
          </div>
        </div>
      ))}
    </>
  );
}

export function SkeletonCard({ count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <article className="metric-card" key={i}>
          <div className="metric-card__top">
            <SkeletonBlock width={80} height={12} />
          </div>
          <SkeletonBlock width={40} height={24} style={{ marginTop: 8 }} />
        </article>
      ))}
    </>
  );
}

export function SkeletonTableRows({ rows = 4, columns = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="skeleton-row">
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c}>
              <SkeletonBlock width="80%" height={14} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonText({ lines = 3, width = '100%' }) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          width={i === lines - 1 ? '60%' : width}
          height={12}
          style={{ marginBottom: 8, display: 'block' }}
        />
      ))}
    </div>
  );
}