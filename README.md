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

- `main`: estructura base (esta).
- `feature/<modulo>`: un módulo por rama.

## Producción

1. Define `VITE_API_URL` con la URL pública de la API (Render), sin barra final.
2. `npm run build` y publica `dist/` en Cloudflare Pages o Vercel.
3. Configura el fallback de SPA (todas las rutas → `index.html`). En Cloudflare Pages lo hace `public/_redirects`.
4. En el backend, habilita **CORS** para el dominio del frontend.
