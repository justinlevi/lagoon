ARG LAGOON_GIT_BRANCH
ARG IMAGE_REPO
ARG UPSTREAM_REPO
ARG UPSTREAM_TAG

# Specific service Image
FROM ${UPSTREAM_REPO:-uselagoon}/node-10:${UPSTREAM_TAG:-latest}

# Setting the workdir to the service, all following commands will run from here
WORKDIR /app/services/billing-api/

# Copying files from our service
COPY . .

# Making sure we run in production
ENV NODE_ENV=production \
    LOGSDB_ADMIN_PASSWORD=admin \
    KEYCLOAK_ADMIN_PASSWORD=admin \
    ELASTICSEARCH_HOST=logs-db-service:9200 \
    ELASTICSEARCH_URL=http://logs-db-service:9200 \
    KEYCLOAK_API_CLIENT_SECRET=39d5282d-3684-4026-b4ed-04bbc034b61a \
    HARBOR_ADMIN_PASSWORD=admin \
    REDIS_PASSWORD=admin

# The API is not very resilient to sudden mariadb restarts which can happen when the api and mariadb are starting
# at the same time. So we have a small entrypoint which waits for mariadb to be fully ready.
COPY wait-for-mariadb.sh /lagoon/entrypoints/99-wait-for-mariadb.sh

RUN yarn build

CMD ["yarn", "start"]
