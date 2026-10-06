'use client';
import { useFormStatus } from 'react-dom';
export default function Submit({ children, className = 'btn' }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? 'Guardando…' : children}
    </button>
  );
}
