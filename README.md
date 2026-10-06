# Vantacard · pedidos, inventario, ventas y finanzas

App personal (Next.js + base de datos Neon) para desplegar en Vercel.

## Qué hace

- **Pedidos**: registras lo que compras en AliExpress, Alibaba, etc. Pones el total que te cobraron y los reembolsos; la app calcula el **costo real por pieza** (con envío y comisiones incluidos).
- **Inventario**: existencias = piezas recibidas − vendidas ± ajustes (piezas dañadas, regalos). Precio de venta, margen y aviso de existencias bajas.
- **Ventas**: varias piezas por venta, envío cobrado, descuento, canal, forma de pago y ventas por cobrar. Guarda el costo de cada pieza al momento de la venta.
- **Finanzas**: utilidad por mes (ventas − costo de lo vendido − gastos), dinero recuperado, gastos y qué producto deja más.
- No calcula impuestos.

Ya trae precargados tus 6 pedidos de septiembre 2026 (5 de AliExpress y 1 de Alibaba).

## Desplegar en Vercel (10 minutos)

1. **Sube el código a GitHub.** Crea un repositorio nuevo en github.com (privado), y arrastra los archivos de esta carpeta con "uploading an existing file". No subas `node_modules` ni `.next` (este zip no los trae).
2. **Importa en Vercel.** vercel.com → Add New… → Project → elige el repositorio → **Deploy**. El primer despliegue puede fallar o mostrar error: es normal, aún falta la base de datos.
3. **Crea la base de datos.** En tu proyecto de Vercel: pestaña **Storage** → **Create Database** → **Neon** (Serverless Postgres, plan gratis) → conéctala al proyecto. Vercel agrega `DATABASE_URL` solo.
4. **Pon tu contraseña.** Settings → Environment Variables → agrega `APP_PASSWORD` con la contraseña que quieras usar para entrar.
5. **Vuelve a desplegar.** Deployments → los tres puntos del último → **Redeploy**.
6. Abre tu URL, entra con tu contraseña. Las tablas y tus pedidos se crean solos la primera vez.

**Tip en iPhone:** abre la app en Safari → Compartir → "Agregar a inicio" y queda como app.

## Cómo registrar un pedido de AliExpress

- **Piezas totales** = paquetes × piezas por paquete (3 paquetes de 5 = 15).
- **Total que pagaste** = lo que te cobraron a la tarjeta (envío y comisión incluidos).
- Si te reembolsan, abre el pedido y escribe el **reembolso**. Si nunca llegó, cambia el estado a **Cancelado / no llegó** y sus piezas no cuentan en el inventario.

## Cambiar la contraseña

Cambia `APP_PASSWORD` en Vercel y haz Redeploy. Todas las sesiones abiertas se cierran.

## Correr en tu computadora (opcional)

```bash
npm install
# crea .env.local con DATABASE_URL (cópiala de Vercel → Storage → Neon) y APP_PASSWORD
npm run dev
```
