#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUCKET=$(cd "$ROOT_DIR/terraform" && terraform output -raw s3_bucket_name)

echo "=== Movie Finder Deployment ==="
echo "Bucket: $BUCKET"
echo ""

# Build frontend
echo "--- Building frontend ---"
cd "$ROOT_DIR/frontend"
npm run build
echo ""

# Sync to S3 (exclude config.json since Terraform manages it)
echo "--- Uploading to S3 ---"
aws s3 sync dist/ "s3://$BUCKET/" --delete --exclude "config.json"
echo ""

echo "=== Deployment Complete ==="
echo "Site: http://$BUCKET.s3-website-us-east-1.amazonaws.com/"
