// Brand-Mark + Brand-Name. Server-component-fähig.

type BrandProps = {
  showName?: boolean;
  showSubtitle?: boolean;
};

export function Brand({ showName = true, showSubtitle = true }: BrandProps) {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden>
        c
      </div>
      {showName ? (
        <div className="brand-name">
          <b>cookingbot</b>
          {showSubtitle ? <span>Familienküche</span> : null}
        </div>
      ) : null}
    </div>
  );
}
