# Vantacard · pedidos, inventario, ventas y finanzas

App personal (Next.js + base de datos Neon) para desplegar en Vercel.

## Qué hace

- **Pedidos**: registras lo que compras en AliExpress, Alibaba, etc. Pones el total que te cobraron y los reembolsos; la app calcula el **costo real por pieza** (con envío y comisiones incluidos).
- **Inventario**: existencias = piezas recibidas − vendidas ± ajustes (piezas dañadas, regalos). Precio de venta, margen y aviso de existencias bajas. Filtros por tipo (tarjetas, placas) y por red (Instagram, Google) que salen del nombre de cada producto.
- **Ventas**: varias piezas por venta, envío cobrado, descuento, canal, forma de pago y ventas por cobrar. Guarda el costo de cada pieza según el corte del que sale (PEPS).
- **Cortes**: cada pedido recibido es un corte. En Pedidos ves el estado de cada uno, en Inicio los cortes activos con su avance y en Finanzas el resumen de los cortes cerrados.
- **Finanzas**: por mes o de todo el tiempo. Utilidad y a dónde se fue cada peso vendido, ventas, ticket promedio, margen y lo que te deben; velocímetro del punto de equilibrio operativo (gastos ÷ margen bruto) y de tu meta de ventas del mes con ritmo y proyección; flujo de dinero, inventario (valor, ganancia potencial y cuántos días te dura), meses, productos que más dejan, canales de venta, cortes cerrados y gastos por categoría.
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

## Cómo funcionan los cortes

- Cada pedido **recibido** es un corte. Los pedidos en camino o cancelados no son cortes.
- Las ventas y las piezas que sacas con un ajuste (mermas) gastan primero las piezas del **pedido más viejo** (PEPS). El orden es por fecha del pedido.
- El costo que guarda cada venta sale del corte del que salieron sus piezas. Si una venta toma piezas de dos cortes, guarda el costo combinado.
- Un corte se **cierra solo** cuando se acaban todas sus piezas (si el pedido trae varios productos, cuando se acaban todos).
- Por cada corte ves: lo que costó el pedido (pagado − reembolso), piezas vendidas y perdidas, lo que vendiste (total de cada venta, con envío y descuento, repartido entre sus piezas según su precio), ganancia (vendido − costo del pedido), % recuperado y en cuántos días se acabó (desde la fecha del pedido).
- Las piezas que **agregas** con un ajuste no tienen costo y solo se usan cuando ya se acabaron todos tus pedidos de ese producto. Lo que vendas de ellas no suma a ningún corte.
- Si vendes **más de lo que tienes**, esas piezas llevan un costo estimado (el del siguiente pedido en camino o, si no hay, el del último que recibiste) hasta que recibas el siguiente pedido.
- Nada de esto se guarda aparte: se calcula con tus pedidos, ventas y ajustes. Si editas o borras algo, los cortes y el costo de las ventas se recalculan solos.

## Cambiar la contraseña

Cambia `APP_PASSWORD` en Vercel y haz Redeploy. Todas las sesiones abiertas se cierran.

## Correr en tu computadora (opcional)

```bash
npm install
# crea .env.local con DATABASE_URL (cópiala de Vercel → Storage → Neon) y APP_PASSWORD
npm run dev
```
