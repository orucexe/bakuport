FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_GOOGLE_MAP_ID=DEMO_MAP_ID
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY VITE_GOOGLE_MAP_ID=$VITE_GOOGLE_MAP_ID
ENV VITE_ALLOW_SAME_ORIGIN_API=true
RUN npm run build
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
