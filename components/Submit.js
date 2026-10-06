'use client';
import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

// close: al terminar de guardar, cierra el apartado (<details>) donde está el botón.
export default function Submit({ children, className = 'btn', close = false }) {
  const { pending } = useFormStatus();
  const ref = useRef(null);
  const saving = useRef(false);
  useEffect(() => {
    if (close && saving.current && !pending) ref.current?.closest('details')?.removeAttribute('open');
    saving.current = pending;
  }, [pending, close]);
  return (
    <button ref={ref} type="submit" className={className} disabled={pending}>
      {pending ? 'Guardando…' : children}
    </button>
  );
}
