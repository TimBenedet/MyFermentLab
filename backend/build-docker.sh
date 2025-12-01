#!/bin/bash

# Script de build et push de l'image Docker backend

set -e

IMAGE_NAME="ghcr.io/timbenedet/myfermentlab-backend"
TAG="latest"

echo "🔨 Building Docker image..."
docker buildx build --platform linux/arm64 -t ${IMAGE_NAME}:${TAG} .

echo "📤 Pushing to GitHub Container Registry..."
docker push ${IMAGE_NAME}:${TAG}

echo "✅ Done!"
echo "Image: ${IMAGE_NAME}:${TAG}"
