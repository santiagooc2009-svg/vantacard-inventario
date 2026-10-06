import './globals.css';

export const metadata = {
  title: 'Vantacard',
  description: 'Pedidos, inventario, ventas y finanzas de Vantacard',
  appleWebApp: { capable: true, title: 'Vantacard', statusBarStyle: 'black-translucent' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0b0d',
  colorScheme: 'dark',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-MX">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400..700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
