type BrandMarkProps = {
  title?: string
}

function BrandMark({ title = 'Prediksi Penjualan Produk' }: BrandMarkProps) {
  return (
    <div className="login-brand" aria-label={title}>
      <div className="login-brand-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="12" width="4" height="9" rx="1" fill="white" />
          <rect x="10" y="7" width="4" height="14" rx="1" fill="white" />
          <rect x="17" y="3" width="4" height="18" rx="1" fill="white" />
        </svg>
      </div>
      <h1 className="login-brand-title">{title}</h1>
    </div>
  )
}

export default BrandMark
