# ============================================================================
# Megaphone application image (Sentinel pattern: sentinel-api/docker/Dockerfile).
#
# One image, several containers: APP_ROLE picks what each one runs
# (web, worker, reverb, scheduler, migrate) - see docker/entrypoint.sh.
#
#   local    bind-mounted source, Composer + Node + Xdebug, used by docker-compose.yml
#   release  self-contained production image (vendor + built assets baked in)
# ============================================================================
ARG NODEJS_VERSION=24
ARG COMPOSER_VERSION=2.10.2
ARG PHP_VERSION=8.4

# ============================================================================
# Base Stage - Runtime dependencies only
# ============================================================================
FROM ubuntu:26.04 AS base

ARG PHP_VERSION
ARG APT_CACHE_HOST

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Kept in the environment so the entrypoint and any `docker exec` can find the
# versioned PHP paths (/etc/php/${PHP_VERSION}/...) without hardcoding them.
ENV PHP_VERSION=${PHP_VERSION}

WORKDIR /app

# Configure APT cache proxy if provided (system-wide configuration)
RUN if [ -n "$APT_CACHE_HOST" ]; then \
        echo "Acquire::http::Proxy \"http://$APT_CACHE_HOST/\";" > /etc/apt/apt.conf.d/99proxy.conf && \
        echo "Acquire::https::Proxy \"http://$APT_CACHE_HOST/\";" >> /etc/apt/apt.conf.d/99proxy.conf && \
        echo "Using APT cache at $APT_CACHE_HOST"; \
    fi

# Install packages.
#
# PHP comes from packages.sury.org rather than ppa:ondrej/php - same maintainer,
# but the PPA has no Ubuntu 26.04 (resolute) suite. It ships
# php${PHP_VERSION}-swoole as a package, so Octane needs no pecl build.
RUN apt update \
    && apt install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    gnupg2 \
    && . /etc/os-release \
    && curl -fsSL https://packages.sury.org/php/apt.gpg -o /usr/share/keyrings/sury-php.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/sury-php.gpg] https://packages.sury.org/php/ ${VERSION_CODENAME} main" > /etc/apt/sources.list.d/sury-php.list \
    && curl -fsSL https://nginx.org/keys/nginx_signing.key | gpg --dearmor > /usr/share/keyrings/nginx-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] https://nginx.org/packages/mainline/ubuntu ${VERSION_CODENAME} nginx" > /etc/apt/sources.list.d/nginx.list \
    && printf "Package: *\nPin: origin nginx.org\nPin: release o=nginx\nPin-Priority: 900\n" > /etc/apt/preferences.d/99nginx \
    && apt update \
    && apt install -y --no-install-recommends \
    dnsutils \
    iputils-ping \
    vim \
    unzip \
    zip \
    git \
    gettext-base \
    cron \
    # Ubuntu >= 24.04 moved the backward-compatible zone names (Asia/Calcutta,
    # Europe/Kiev, US/Eastern...) into their own package, and browsers still
    # hand us those names. Without it `new DateTimeZone('Asia/Calcutta')` throws.
    tzdata-legacy \
    # Web server and process management
    nginx \
    supervisor \
    # PHP and extensions. exif/pcntl/sockets/posix ship inside -cli on Debian/Ubuntu.
    php${PHP_VERSION}-cli \
    php${PHP_VERSION}-bcmath \
    php${PHP_VERSION}-curl \
    php${PHP_VERSION}-gd \
    php${PHP_VERSION}-intl \
    php${PHP_VERSION}-mbstring \
    php${PHP_VERSION}-mysql \
    php${PHP_VERSION}-opcache \
    php${PHP_VERSION}-readline \
    php${PHP_VERSION}-redis \
    php${PHP_VERSION}-swoole \
    php${PHP_VERSION}-xml \
    php${PHP_VERSION}-zip \
    && apt clean \
    && rm -rf /var/lib/apt/lists/*

# Configure PHP
COPY docker/php/php-cli.ini /etc/php/${PHP_VERSION}/cli/conf.d/99-app.ini

# Configure Nginx (the in-container one that fronts Octane; TLS lives in docker/edge)
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/templates/ /etc/nginx/templates/

# The official nginx.org package omits the sites-available/sites-enabled layout
# Debian's package provides; the entrypoint renders templates into it.
RUN mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

# Configure Supervisor (one program set per APP_ROLE)
COPY docker/supervisor/web.conf /etc/supervisor/conf.d/web.conf
COPY docker/supervisor/worker.conf /etc/supervisor/conf.d/worker.conf
COPY docker/supervisor/reverb.conf /etc/supervisor/conf.d/reverb.conf
COPY docker/supervisor/scheduler.conf /etc/supervisor/conf.d/scheduler.conf

# Copy cron configuration
COPY docker/cron/scheduler /etc/cron.d/scheduler

# Create application directories with proper permissions
RUN mkdir -p /app/storage /app/bootstrap/cache \
    && chown -R www-data:www-data /app \
    && chmod -R ug+rwx /app/storage /app/bootstrap/cache

EXPOSE 80

COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]


# ============================================================================
# Extensions Stage - pecl builds, so the toolchain never enters a runtime image
# ============================================================================
FROM base AS extensions

ARG PHP_VERSION

# ev: the event loop Reverb needs above 1,000 connections. Without it ReactPHP
# runs on stream_select, whose fd_set is compiled into PHP at 1,024 descriptors,
# and Reverb exits silently once a socket lands on descriptor 1,024. One 500-person
# room alone gets close to that. ReactPHP picks ev up by its presence. Sury ships
# no php8.4-ev for Ubuntu 26.04, hence pecl. The tarball is fetched directly:
# `pecl install ev-1.2.3` against the channel answers "No releases available"
# from a fresh php-pear install.
RUN apt update \
    && apt install -y --no-install-recommends \
    build-essential \
    php-pear \
    php${PHP_VERSION}-dev \
    && curl -fsSL https://pecl.php.net/get/ev-1.2.3.tgz -o /tmp/ev.tgz \
    && pecl install /tmp/ev.tgz \
    && cp "$(php-config --extension-dir)/ev.so" /ev.so \
    && apt clean \
    && rm -rf /var/lib/apt/lists/*


# ============================================================================
# Local Stage - Build tools and dev dependencies for local development
# ============================================================================
FROM base AS local

ARG PHP_VERSION
ARG NODEJS_VERSION
ARG COMPOSER_VERSION
ARG NPM_REGISTRY_HOST

ENV BUILD_TARGET=local

RUN apt update && apt install -y --no-install-recommends \
    build-essential \
    libssl-dev \
    php${PHP_VERSION}-xdebug \
    && apt clean \
    && rm -rf /var/lib/apt/lists/*

# Node.js builds the Inertia/React assets in-container (Wayfinder shells out to
# `php artisan` during the Vite build, so the two have to live together).
RUN curl -fsSL https://deb.nodesource.com/setup_${NODEJS_VERSION}.x | bash - \
    && apt install -y nodejs \
    && apt clean \
    && rm -rf /var/lib/apt/lists/*

# Configure NPM registry if provided (system-wide configuration)
RUN if [ -n "$NPM_REGISTRY_HOST" ]; then \
        npm config set registry "http://$NPM_REGISTRY_HOST/" --location=global && \
        echo "Using NPM registry at $NPM_REGISTRY_HOST"; \
    fi

RUN curl -sS https://getcomposer.org/installer | php -- --version=${COMPOSER_VERSION} --install-dir=/usr/local/bin --filename=composer \
    && chmod +x /usr/local/bin/composer

# Xdebug is disabled on the CLI SAPI by default: Octane *is* the CLI SAPI here,
# so leaving it on would tax every request. Enable per-shell with
# XDEBUG_MODE=debug when you actually want to step through code.
COPY docker/php/xdebug.ini /etc/php/${PHP_VERSION}/cli/conf.d/20-xdebug.ini
RUN phpdismod -s cli xdebug

# The ev event loop (see the extensions stage), enabled for every role; only Reverb uses it.
COPY --from=extensions /ev.so /tmp/ev.so
RUN cp /tmp/ev.so "$(php -r 'echo ini_get("extension_dir");')/ev.so" \
    && rm /tmp/ev.so \
    && echo "extension=ev.so" > /etc/php/${PHP_VERSION}/mods-available/ev.ini \
    && phpenmod ev \
    && php -r 'extension_loaded("ev") || exit(1);'


# ============================================================================
# Builder Stage - Build production artifacts
# ============================================================================
FROM base AS builder

ARG NODEJS_VERSION
ARG COMPOSER_VERSION

# Node is only needed to build the Vite assets; it is not carried into the release image.
RUN curl -sS https://getcomposer.org/installer | php -- \
    --version=${COMPOSER_VERSION} \
    --install-dir=/usr/local/bin \
    --filename=composer \
    && chmod +x /usr/local/bin/composer \
    && curl -fsSL https://deb.nodesource.com/setup_${NODEJS_VERSION}.x | bash - \
    && apt install -y nodejs \
    && apt clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --chown=www-data:www-data . /app

# The writable skeleton Laravel expects. .dockerignore drops storage/ from the
# context, so the image creates it itself.
RUN mkdir -p storage/app/public storage/app/private storage/framework/cache/data \
    storage/framework/sessions storage/framework/testing storage/framework/views \
    storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

RUN composer install \
    --no-dev \
    --optimize-autoloader \
    --no-interaction \
    --prefer-dist

RUN npm ci && npm run build

# Laravel's config/route/view/event caches are built by the entrypoint at
# container start, not here: they need the environment the container runs with.

RUN rm -rf /app/.git \
    && rm -rf /app/node_modules \
    && rm -rf /app/tests


# ============================================================================
# Release Stage - Minimal production image
# ============================================================================
FROM base AS release

COPY --from=builder --chown=www-data:www-data /app /app

COPY --from=extensions /ev.so /tmp/ev.so
RUN cp /tmp/ev.so "$(php -r 'echo ini_get("extension_dir");')/ev.so" \
    && rm /tmp/ev.so \
    && echo "extension=ev.so" > /etc/php/${PHP_VERSION}/mods-available/ev.ini \
    && phpenmod ev \
    && php -r 'extension_loaded("ev") || exit(1);'
