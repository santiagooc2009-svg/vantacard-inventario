'use client';
import { useEffect, useRef, useState } from 'react';

// Fecha y entrega de una venta. Si la fecha es futura, la venta queda "por entregar".
export default function DeliveryFields({ today }) {
  const ref = useRef(null);
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState('entregada');
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const reset = () => {
      setDate(today);
      setMode('entregada');
    };
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, [today]);

  const future = date > today;
  const pending = future || mode === 'por_entregar';
  return (
    <>
      <label ref={ref}>
        {pending ? 'Fecha de entrega' : 'Fecha'}
        <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        Entrega
        <select name="delivery" value={pending ? 'por_entregar' : 'entregada'} onChange={(e) => setMode(e.target.value)}>
          <option value="entregada" disabled={future}>Ya la entregué</option>
          <option value="por_entregar">Por entregar</option>
        </select>
      </label>
    </>
  );
}
