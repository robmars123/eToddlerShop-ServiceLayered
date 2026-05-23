FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci --legacy-peer-deps
COPY . .

ARG VITE_API_URL
ARG VITE_ENTRA_AUTHORITY
ARG VITE_ENTRA_CLIENT_ID
ARG VITE_ENTRA_SCOPES

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ENTRA_AUTHORITY=$VITE_ENTRA_AUTHORITY
ENV VITE_ENTRA_CLIENT_ID=$VITE_ENTRA_CLIENT_ID
ENV VITE_ENTRA_SCOPES=$VITE_ENTRA_SCOPES

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
