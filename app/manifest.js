// Para instalar la app en la pantalla de inicio (Safari → Compartir → Agregar a inicio).
export default function manifest() {
  return {
    name: 'Vantacard',
    short_name: 'Vantacard',
    description: 'Pedidos, inventario, ventas y finanzas de Vantacard',
    lang: 'es-MX',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f5f1',
    theme_color: '#14161c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
