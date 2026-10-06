'use client';
export default function ConfirmButton({ children, message = '¿Seguro?', className = 'btn-ghost danger' }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
