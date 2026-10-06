// Marca de vantacard.pro: persona + ondas NFC, divisor y "Vanta Card".
export default function BrandMark({ big = false }) {
  return (
    <span className={'brand-mark' + (big ? ' big' : '')}>
      <svg className="brand-mark__icon" viewBox="0 0 40 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <circle cx="8" cy="9" r="5" />
        <path d="M1 27v-2a7 7 0 0 1 7-7 7 7 0 0 1 7 7v2" strokeLinejoin="round" />
        <path d="M20 11a8 8 0 0 1 0 12" opacity="0.9" />
        <path d="M25 7a14 14 0 0 1 0 20" opacity="0.6" />
        <path d="M30 3a20 20 0 0 1 0 28" opacity="0.35" />
      </svg>
      <span className="brand-mark__divider" aria-hidden="true" />
      <span className="brand-mark__wordmark"><span>Vanta</span><span>Card</span></span>
    </span>
  );
}
