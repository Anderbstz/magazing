# Etapa 1: compila la SPA con Vite.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Las variables VITE_* se incrustan al compilar. Render pasa las variables de entorno
# del servicio como build args, así que basta con definir VITE_API_URL en el panel.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Etapa 2: sirve los archivos estáticos con nginx.
FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Render asigna el puerto en la variable PORT; la imagen de nginx la reemplaza
# en la plantilla al arrancar. En local se usa 8080.
ENV PORT=8080
EXPOSE 8080
