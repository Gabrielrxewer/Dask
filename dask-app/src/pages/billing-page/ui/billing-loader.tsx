export function BillingLoader({ visible }: { visible: boolean }) {
  return (
    <div className={`billing-loader${visible ? "" : " billing-loader--out"}`} aria-hidden="true">
      <div className="billing-loader__stage">
        <span className="billing-loader__particle billing-loader__particle--1">R$</span>
        <span className="billing-loader__particle billing-loader__particle--2">$</span>
        <span className="billing-loader__particle billing-loader__particle--3">€</span>
        <span className="billing-loader__particle billing-loader__particle--4">R$</span>
        <span className="billing-loader__particle billing-loader__particle--5">$</span>
        <span className="billing-loader__particle billing-loader__particle--6">€</span>

        <div className="billing-loader__card">
          <div className="billing-loader__card-face">
            <div className="billing-loader__card-top">
              <div className="billing-loader__card-chip" />
              <div className="billing-loader__card-wifi" />
            </div>
            <div className="billing-loader__card-number">•••• •••• •••• ••••</div>
            <div className="billing-loader__card-meta">
              <div className="billing-loader__card-meta-group">
                <span className="billing-loader__card-label">Titular</span>
                <span className="billing-loader__card-value">DASK USER</span>
              </div>
              <div className="billing-loader__card-meta-group">
                <span className="billing-loader__card-label">Validade</span>
                <span className="billing-loader__card-value">••/••</span>
              </div>
            </div>
          </div>
          <div className="billing-loader__card-shimmer" />
        </div>

        <div className="billing-loader__bar-wrap">
          <div className="billing-loader__bar" />
        </div>
        <p className="billing-loader__label">
          Carregando cobrança<span className="billing-loader__dots" />
        </p>
      </div>
    </div>
  );
}
