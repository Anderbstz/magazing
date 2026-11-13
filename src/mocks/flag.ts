/**
 * ¿Están activos los datos simulados?
 * Solo en desarrollo, y se pueden apagar con `VITE_MOCKS=off` en `.env.local`.
 * Este archivo no importa MSW, así que se puede usar en cualquier parte sin inflar el bundle.
 */
export const mocksEnabled = import.meta.env.DEV && import.meta.env.VITE_MOCKS !== 'off'
