# Magazing · Frontend

Panel web de **Magazing** (inventario y ventas para pymes). Consume la API REST en .NET 10.

## Stack

| Para qué | Herramienta |
|---|---|
| Base | Vite 8 + React 19 + TypeScript |
| Estilos | Tailwind CSS 4 (componentes propios en `src/components/ui`) |
| Navegación | React Router |
| Datos del servidor | TanStack Query |
| Formularios | react-hook-form + zod |
| HTTP | axios (cliente único en `src/api/http.ts`) |
| Íconos / avisos | lucide-react / sonner |
| Gráficos | Recharts |
| Datos simulados (solo dev) | MSW |
| Tests | Vitest |

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # opcional
npm run dev                  # http://localhost:5173
```

En desarrollo, Vite reenvía `/api/*` a `http://localhost:5261` (el perfil `http` del backend), así que **no hace falta CORS** en local. Levanta primero la API:

```bash
dotnet run --project ../backend/Magazing/Magazing.Api --launch-profile http
```

Usuario de desarrollo: el que crea `backend/database/02_seed.sql` (ver comentario al inicio del archivo).

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Revisa tipos y genera `dist/` |
| `npm run typecheck` | Solo revisa tipos |
| `npm run lint` | oxlint |
| `npm run preview` | Sirve el build localmente |
| `npm test` | Tests unitarios (Vitest) |

## Estructura

```
src/
├─ api/            cliente HTTP, normalización de errores, tipos compartidos (PagedResult)
├─ app/            router, providers, páginas globales (404)
├─ components/
│  ├─ ui/          botones, inputs, tablas, modales… (sin dependencias de negocio)
│  └─ …            piezas de layout compartidas
├─ config/         permisos (espejo del backend)
├─ hooks/          hooks genéricos
├─ lib/            utilidades: formato de moneda/fechas, query client, cn()
└─ features/       un módulo por carpeta, igual que el backend
   ├─ auth/        login, sesión, refresh token, guards por permiso
   ├─ dashboard/
   ├─ catalog/     productos, categorías, marcas, unidades, precios
   ├─ inventory/   stock, kardex, ajustes, transferencias
   ├─ purchases/   proveedores, órdenes de compra
   ├─ sales/       punto de venta, clientes, comprobantes
   ├─ reports/
   ├─ forecast/    predicción de demanda y alertas
   └─ admin/       usuarios, roles y permisos
```

Cada módulo sigue el mismo patrón:

```
features/<modulo>/
├─ api.ts          tipos (espejo de los DTO) y funciones que llaman a la API
├─ queries.ts      hooks de TanStack Query (useXxx, useCreateXxx…)
├─ routes.tsx      rutas del módulo
└─ pages/ y components/
```

## Ramas

- `main`: estructura base.
- `feature/<modulo>`: un módulo por rama, apiladas en este orden (cada una sale de la anterior):
  `auth` → `catalog` → `admin` → `mocks` → `inventory` → `purchases` → `sales` → `dashboard`.

## Producción

1. Define `VITE_API_URL` con la URL pública de la API (Render), sin barra final.
2. `npm run build` y publica `dist/` en Cloudflare Pages o Vercel.
3. Configura el fallback de SPA (todas las rutas → `index.html`). En Cloudflare Pages lo hace `public/_redirects`.
4. En el backend, habilita **CORS** para el dominio del frontend.

## Datos simulados (MSW)

El backend todavía no expone inventario, compras, ventas ni reportes. Para terminar el frontend
sin esperar, en **desarrollo** esos endpoints los responde [MSW](https://mswjs.io) desde el navegador:

- Lo que no está simulado (login, catálogo, usuarios, roles) va al backend real.
- Los datos simulados usan **tus productos reales** del catálogo y generan ~16 semanas de historia
  (ventas, compras, transferencias) con las mismas reglas del MVP: kardex, costo promedio ponderado,
  stock no negativo, IGV incluido, correlativos por serie y factura solo con RUC.
- Se guardan en `localStorage`; el botón **Reiniciar datos** del menú lateral los regenera.
- Apagar: `VITE_MOCKS=off` en `.env.local`. En producción MSW no entra al bundle.

Cuando el backend implemente un endpoint, se borra su handler en `src/features/<modulo>/mocks.ts`
y el frontend sigue igual. Los tipos de `src/features/<modulo>/api.ts` son el contrato que deben
cumplir los DTO de .NET (JSON en camelCase, listas paginadas con `PagedResult`, errores `{ "error": "..." }`).

| Módulo | Endpoints simulados |
|---|---|
| Inventario | `GET /warehouses` · `GET /stocks` · `GET /stocks/summary` · `GET /inventory/movements` · `POST /inventory/adjustments` · `GET/POST /transfers` · `GET /transfers/{id}` · `POST /transfers/{id}/complete` · `POST /transfers/{id}/cancel` |
| Compras | `GET/POST /suppliers` · `PUT /suppliers/{id}` · `GET/POST /purchase-orders` · `GET/PUT /purchase-orders/{id}` · `POST /purchase-orders/{id}/approve` · `.../receive` · `.../cancel` |
| Ventas | `GET /payment-methods` · `GET/POST /customers` · `PUT /customers/{id}` · `GET/POST /sales` · `GET /sales/{id}` · `POST /sales/{id}/cancel` |
| Reportes y ML | `GET /reports/dashboard` · `GET /reports/sales` · `GET /reports/top-products` · `GET /predictions` · `POST /predictions/run` · `GET /alerts` · `POST /alerts/{id}/acknowledge` · `POST /alerts/{id}/resolve` |

## Tests

```bash
npm test
```

Cubren el cálculo de IGV y las reglas de la base simulada (kardex, costo promedio, correlativos, RUC en factura).
