#!/bin/sh
set -e

# Wait for MinIO to be ready and set alias
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  echo "Waiting for MinIO..."
  sleep 2
done

# Create private buckets
mc mb --ignore-existing local/avatars
mc mb --ignore-existing local/photos
mc mb --ignore-existing local/audio

# Ensure all buckets are private (no anonymous access)
mc anonymous set none local/avatars
mc anonymous set none local/photos
mc anonymous set none local/audio

echo "MinIO buckets created: avatars, photos, audio (all private)"
