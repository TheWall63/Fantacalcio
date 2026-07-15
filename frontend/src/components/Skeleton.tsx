interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width = "100%", height = "1rem", className = "" }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={{ width, height }} />;
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="skeleton-row" />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 8 }: { count?: number }) {
  return (
    <div className="player-card-grid">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height="196px" />
      ))}
    </div>
  );
}
