# Build stage
FROM node:20 AS build
WORKDIR /app
ARG REACT_APP_API_BASE_URL="http://localhost:8000"
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Runtime stage
FROM node:20 AS runner
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/build ./build
ENV PORT=3000
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
