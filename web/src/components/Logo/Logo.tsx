import markUrl from "../../assets/brand/mark.svg";

/** Variantes del logo horizontal Nachipa. */
type LogoProps = {
  /**
   * sidebar = wordmark chico; auth = login; mark = solo isotipo (rail contraído).
   */
  size?: "sidebar" | "auth" | "mark";
};

/**
 * Logo Nachipa Wellboats (Figma Logo/Horizontal).
 * En menú contraído solo se muestra el mark de 27px.
 */
export function Logo({ size = "sidebar" }: LogoProps) {
  // Solo isotipo del rail Figma (72px de ancho).
  if (size === "mark") {
    return (
      <img
        src={markUrl}
        alt="Nachipa Wellboats"
        className="size-[27px] shrink-0"
      />
    );
  }

  const markClass = size === "auth" ? "size-[42px]" : "size-[27px]";
  const titleClass =
    size === "auth"
      ? "text-[30px] leading-[36px] tracking-[1.8px]"
      : "text-[20px] leading-[23px] tracking-[1.2px]";
  const subtitleClass =
    size === "auth" ? "text-[13px] leading-[17px]" : "text-[9px] leading-[11px]";

  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <img src={markUrl} alt="" className={markClass} />
      <div className="flex min-w-0 flex-col text-[var(--color-nav-logo)]">
        <span className={`font-brand font-medium ${titleClass}`}>NACHIPA</span>
        <span className={`font-brand font-normal ${subtitleClass} pl-0.5`}>
          Wellboats
        </span>
      </div>
    </div>
  );
}
