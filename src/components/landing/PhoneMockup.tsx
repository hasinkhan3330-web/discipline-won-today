type Props = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  /** Optional crop tweak for screenshots with edge flaws, e.g. "center 2%". */
  position?: string;
};

/** Landing-only phone frame: fixed 9/19 ratio, same bezel for every screenshot. */
export function PhoneMockup({ src, alt, className, priority, position }: Props) {
  return (
    <div className={`axl-mock${className ? ` ${className}` : ""}`}>
      <div className="axl-mock-screen">
        <img
          src={src}
          alt={alt}
          width={440}
          height={904}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : undefined}
          style={position ? { objectPosition: position } : undefined}
        />
      </div>
    </div>
  );
}
