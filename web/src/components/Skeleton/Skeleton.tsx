/** Bloque shimmer reutilizable para estados de carga. */
type SkeletonProps = {
  className?: string;
};

/** Rectángulo animado (shimmer) que marca espacio mientras llega el dato. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`animate-shimmer rounded-[var(--radius-md)] bg-[var(--color-nav-item-active-bg)] ${className}`}
    />
  );
}
