# Stage 1: Build the Svelte application
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve the built application with Nginx
FROM nginx:alpine

# Copy the static files from the 'build' directory created in the previous stage
COPY --from=builder /app/build/ /usr/share/nginx/html

# Remove default nginx config and copy our custom config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
