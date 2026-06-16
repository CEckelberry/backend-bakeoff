#!/bin/sh
set -e
php-fpm --daemonize
exec nginx -g "daemon off;"
