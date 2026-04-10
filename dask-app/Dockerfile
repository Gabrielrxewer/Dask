FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH

ARG VITE_API_BASE_URL=http://localhost:3333
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

ARG VITE_API_PREFIX=/api/v1
ENV VITE_API_PREFIX=$VITE_API_PREFIX

ARG VITE_AUTH_TRANSPORT_MODE=cookie-session
ENV VITE_AUTH_TRANSPORT_MODE=$VITE_AUTH_TRANSPORT_MODE

ARG VITE_CSRF_HEADER_NAME=x-csrf-token
ENV VITE_CSRF_HEADER_NAME=$VITE_CSRF_HEADER_NAME

RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
