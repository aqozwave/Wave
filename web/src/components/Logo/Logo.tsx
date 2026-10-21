import markUrl from "../../assets/brand/mark.svg";

type LogoProps = {
  size?: "sidebar" | "auth";
};

export function Logo({ size = "sidebar" }: LogoProps) {
  const markClass = size === "auth" ? "size-[42px]" : "size-[27px]";
  const titleClass =
    size === "auth"
      ? "text-[30px] leading-[36px] tracking-[1.8px]"
      : "text-[20px] leading-[23px] tracking-[1.2px]";
  const subtitleClass =
    size === "auth" ? "text-[13px] leading-[17px]" : "text-[9px] leading-[11px]";

  return (
    <div className="flex items-center gap-2.5">
      <img src={markUrl} alt="" className={markClass} />
      <div className="flex flex-col text-[var(--color-nav-logo)]">
        <span className={`font-brand font-medium ${titleClass}`}>NACHIPA</span>
        <span className={`font-brand font-normal ${subtitleClass} pl-0.5`}>
          Wellboats
        </span>
      </div>
    </div>
  );
}
