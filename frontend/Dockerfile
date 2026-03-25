# build stage
FROM node:22-alpine AS builder
WORKDIR /app
ARG VITE_SANDBOX_BACKEND_HOST
ARG VITE_SANDBOX_BACKEND_PORT
ENV VITE_SANDBOX_BACKEND_HOST=$VITE_SANDBOX_BACKEND_HOST
ENV VITE_SANDBOX_BACKEND_PORT=$VITE_SANDBOX_BACKEND_PORT

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# runtime stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
