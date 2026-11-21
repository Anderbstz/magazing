# Magazing · Frontend

Panel web de **Magazing**, sistema de inventario, compras y ventas para pymes. Es una SPA que consume la API REST en .NET 10 ([magazing-api](https://github.com/Anderbstz/magazing-api)).

## Stack

| Para qué | Herramienta |
|---|---|
| Base | Vite 8 + React 19 + TypeScript |
| Estilos | Tailwind CSS 4 (componentes propios en `src/components/ui`) |
| Navegación | React Router (rutas declaradas por módulo, carga diferida) |
| Datos del servidor | TanStack Query (caché, reintentos, invalidación tras guardar) |
| Formularios | react-hook-form + zod |
| HTTP | axios (cliente único en `src/api/http.ts`) |
| Íconos / avisos | lucide-react / sonner |
| Gráficos | Recharts |
| Calidad | oxlint, Vitest, `tsc` |

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # opcional
npm run dev                  # http://localhost:5173
```

En desarrollo, Vite reenvía `/api/*` al backend (`VITE_DEV_API_TARGET`, por defecto `http://localhost:5261`), así que **no hace falta CORS** en local. Levanta primero la API:

```bash
dotnet run --project ../backend/Magazing/Magazing.Api --launch-profile http
```

Usuario de desarrollo: el que crea `backend/database/02_seed.sql` (ver el comentario al inicio del archivo).

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Revisa tipos y genera `dist/` |
| `npm run typecheck` | Solo revisa tipos |
| `npm run lint` | oxlint |
| `npm run preview` | Sirve el build localmente |
| `npm test` | Tests unitarios (Vitest) |

## Variables de entorno

| Variable | Dónde | Valor |
|---|---|---|
| `VITE_API_URL` | Producción | URL pública de la API, sin barra final (ej. `https://magazing-api.onrender.com`). En desarrollo va vacía. |
| `VITE_DEV_API_TARGET` | Solo desarrollo | A dónde reenvía Vite `/api` (por defecto `http://localhost:5261`). |

Las variables `VITE_*` se **incrustan al compilar**: si cambian, hay que volver a hacer `npm run build`.

## Estructura

```
src/
├─ main.tsx            arranque: interceptores de auth + providers + router
├─ app/                router.tsx (une las rutas de los módulos), navigation.ts (menú), providers, 404
├─ api/                http.ts (axios + ApiError), download.ts (Excel/PDF), types.ts (Guid, PagedResult…)
├─ config/             permissions.ts: los 21 permisos, espejo del backend
├─ components/
│  ├─ ui/              botón, input, tabla, diálogo, paginación… (sin lógica de negocio)
│  ├─ layout/          app-shell (sidebar, cabecera, usuario)
│  └─ …                piezas compartidas entre módulos (page-header, stat-card, product-picker, download-button)
├─ hooks/              hooks genéricos (use-debounced-value)
├─ lib/                utilidades puras: formato de moneda y fechas, IGV, CSV, query client, cn()
└─ features/           un módulo por carpeta, igual que los UseCases del backend
   ├─ auth/            login, sesión, refresh token, guards por permiso
   ├─ dashboard/       inicio (indicadores o accesos rápidos según el rol)
   ├─ catalog/         productos, categorías, marcas, unidades, precios
   ├─ inventory/       stock, kardex, ajustes, transferencias
   ├─ purchases/       proveedores, órdenes de compra, recepción
   ├─ sales/           punto de venta, ventas, clientes, comprobantes
   ├─ reports/         reportes, predicción de demanda y alertas
   ├─ admin/           usuarios, roles y permisos
   └─ settings/        empresa, sucursales, almacenes, series, pagos, correos, perfil
```

### Anatomía de un módulo

Todos los módulos siguen el mismo patrón. Si sabes leer uno, sabes leerlos todos:

```
features/<modulo>/
├─ api.ts        contrato con la API: tipos (espejo de los DTO de .NET) + funciones que llaman a http
├─ queries.ts    hooks de TanStack Query: useXxx (lecturas) y useCreateXxx / useSaveXxx (escrituras)
├─ routes.tsx    rutas del módulo, cada una protegida por su permiso
├─ labels.ts     (opcional) textos legibles de estados y códigos: DRAFT → "Borrador"
├─ pages/        pantallas completas, una por ruta: <nombre>-page.tsx
└─ components/   piezas usadas solo por este módulo (diálogos, selectores, formularios)
```

## Reglas

**`api.ts`: solo el contrato**
- Tipos con los mismos nombres y forma que los DTO del backend (JSON en camelCase, listas paginadas con `PagedResult<T>`).
- Funciones que llaman a `http` y devuelven `r.data`. Nada de estado, toasts ni React.
- Si el backend cambia un DTO, se cambia aquí primero y TypeScript señala todo lo que se rompe.

**`queries.ts`: el estado del servidor**
- Un objeto `xxxKeys` con las claves de caché del módulo.
- Lecturas con `useQuery` y escrituras con `useMutation`. Cada mutación **invalida** las claves afectadas (por ejemplo, vender invalida ventas y stock) y muestra el `toast.success`.
- Los errores de las mutaciones los muestra el `queryClient` global (`src/lib/query-client.ts`), salvo que la pantalla los maneje con `meta: { silent: true }`.
- Las pantallas **nunca** llaman a `api.ts` directo: siempre a través de un hook.

**`pages/` y `components/`**
- Una página por ruta, con el nombre `<nombre>-page.tsx`. Arma la pantalla con hooks de `queries.ts` y componentes de `components/ui`.
- Si una pieza la usan dos módulos o más, sube a `src/components/`. Si es genérica (sin negocio), va a `src/components/ui/`.

**Nombres**
- Archivos en **kebab-case** (`product-form-dialog.tsx`, `use-auth.ts`) y componentes en **PascalCase** dentro del archivo.
- Imports absolutos con `@/` (por ejemplo `@/components/ui/button`); relativos solo dentro del mismo módulo (`../api`).

### Permisos

La seguridad real la aplica la API (responde 403). El frontend solo **oculta lo que el usuario no puede usar**, en tres niveles:

| Nivel | Cómo | Ejemplo |
|---|---|---|
| Menú | `permission` en cada ítem de `src/app/navigation.ts`; los ítems sin permiso se ocultan solos | Reportes solo aparece con `reports.read` |
| Ruta | `<RequirePermission permission={...}>` en `routes.tsx`; sin permiso se ve "Sin acceso" | `/sales/pos` exige `sales.create` |
| Botón o sección | `<Can permission={...}>` o `useCan()` dentro de la página | "Anular venta" solo con `sales.cancel` |

Los permisos llegan en el login (claims del JWT) y se renuevan con el refresh token. Si se agrega un permiso en el backend, se agrega también en `src/config/permissions.ts`.

| Rol (seed) | Qué hace |
|---|---|
| ADMIN | Todo |
| WAREHOUSE | Stock, kardex, ajustes, transferencias, recibir compras, alertas |
| PURCHASING | Proveedores, órdenes de compra (crear y aprobar), reportes, alertas |
| SALES | Punto de venta, ventas, clientes, comprobantes |

### Agregar un módulo nuevo

1. Crear `src/features/<modulo>/` con `api.ts`, `queries.ts`, `routes.tsx` y `pages/`.
2. Escribir en `api.ts` los tipos del contrato con la API y sus funciones.
3. Crear en `queries.ts` los hooks, con sus claves de caché y las invalidaciones de cada mutación.
4. Crear las páginas en `pages/` usando esos hooks.
5. Declarar las rutas en `routes.tsx`, cada una dentro de un `RequirePermission`.
6. Registrar las rutas en `src/app/router.tsx` (`...moduloRoutes`) y el menú en `src/app/navigation.ts`, con su permiso.
7. Si el módulo trae permisos nuevos, agregarlos en `src/config/permissions.ts`.

## Sesión

- El access token vive en memoria. El refresh token y los datos del usuario van a `localStorage` para sobrevivir a la recarga.
- Al cargar la app, `RequireAuth` renueva la sesión con `/auth/refresh`. Si falla con 401, manda al login.
- `src/features/auth/interceptors.ts` agrega el token a cada petición y, ante un 401, intenta renovar una vez antes de cerrar la sesión.

## Descargas (Excel y PDF)

`src/api/download.ts` pide el archivo con el token de la sesión, toma el nombre de `Content-Disposition` y muestra el mensaje real del backend si falla. En las pantallas se usa `<DownloadButton path=... params=... fallbackName=...>`.

## Producción (Render, Static Site)

1. **Build command:** `npm ci && npm run build`. **Publish directory:** `dist`.
2. Definir `VITE_API_URL` con la URL pública de la API.
3. Agregar una regla **Rewrite** de `/*` a `/index.html`, para que las rutas de React no den 404 al recargar (`public/_redirects` hace lo mismo en Cloudflare Pages y Netlify).
4. En el backend, habilitar **CORS** para el dominio del frontend y **exponer la cabecera `Content-Disposition`**, para que las descargas usen el nombre que manda el servidor.

## Tests

```bash
npm test
```

Cubren el cálculo de IGV (`src/lib/tax.test.ts`).
