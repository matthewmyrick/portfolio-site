#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# GitHub Actions style step formatting
print_step() {
    echo -e "${BLUE}##[group]$1${NC}"
}

print_end_group() {
    echo -e "${BLUE}##[endgroup]${NC}"
}

print_notice() {
    echo -e "${GREEN}::notice::$1${NC}"
}

print_error() {
    echo -e "${RED}::error::$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}::warning::$1${NC}"
}

print_step "🚀 Portfolio Web Build and Release"
echo -e "${GREEN}Starting build and release process...${NC}"
print_end_group

print_step "🔧 Check dependencies"
# Docker should be available on macOS
if ! command -v docker &> /dev/null; then
    print_error "Docker is required but not installed"
    echo "Please install Docker Desktop for Mac"
    exit 1
else
    echo "Docker is available"
fi
print_end_group

print_step "📋 Get current version from package.json"
# Get version from portfolio-web/package.json
if [ ! -f "./portfolio-web/package.json" ]; then
    print_error "portfolio-web/package.json not found"
    exit 1
fi

CURRENT_VERSION=$(node -p "require('./portfolio-web/package.json').version")
CURRENT_TAG="v$CURRENT_VERSION"
echo "Current version in package.json: $CURRENT_VERSION"
echo "Current tag: $CURRENT_TAG"
print_end_group

print_step "🔍 Check if version already exists"
# Check if tag already exists locally
if git tag -l | grep -q "^$CURRENT_TAG$"; then
    print_error "Tag $CURRENT_TAG already exists locally"
    echo "Please update the version in portfolio-web/package.json before releasing"
    exit 1
fi

# Check if tag exists on remote
if git ls-remote --tags origin | grep -q "refs/tags/$CURRENT_TAG$"; then
    print_error "Tag $CURRENT_TAG already exists on remote"
    echo "Please update the version in portfolio-web/package.json before releasing"
    exit 1
fi

# Check if GitHub release already exists
if gh release view "$CURRENT_TAG" >/dev/null 2>&1; then
    print_error "GitHub release $CURRENT_TAG already exists"
    echo "Please update the version in portfolio-web/package.json before releasing"
    exit 1
fi

print_notice "Version $CURRENT_TAG is available for release"
print_end_group

print_step "📦 Build Docker image"
echo "Building Docker image for portfolio-web..."

# Check if portfolio-web directory exists
if [ ! -d "./portfolio-web" ]; then
    print_error "portfolio-web directory not found"
    exit 1
fi

cd ./portfolio-web
echo "Building image with tag: temp-image (targeting linux/amd64 for K3s compatibility)"
docker build --platform linux/amd64 -t temp-image .
cd ..
print_notice "Docker image built successfully"
print_end_group

print_step "🏷️ Tag and push Docker images"
echo "Tagging images..."
docker tag temp-image 192.168.1.168:30003/frontend/portfolio-web:$CURRENT_TAG
docker tag temp-image 192.168.1.168:30003/frontend/portfolio-web:latest

echo "Attempting to push images to Harbor registry (may require insecure registry config)..."
echo "If this fails, you may need to configure Docker to allow insecure registries"

echo "Pushing image with tag: $CURRENT_TAG"
if ! docker push 192.168.1.168:30003/frontend/portfolio-web:$CURRENT_TAG; then
    print_error "Push failed - Harbor registry requires insecure registry configuration"
    echo "Add '192.168.1.168:30003' to Docker Desktop's insecure registries:"
    echo "Docker Desktop > Settings > Docker Engine > Add to 'insecure-registries' array"
    echo "Then restart Docker and try again"
    exit 1
fi

echo "Pushing image with tag: latest"
docker push 192.168.1.168:30003/frontend/portfolio-web:latest

print_notice "Images pushed successfully to Harbor registry"
print_end_group

print_step "🏷️ Create and push Git tag"
echo "Creating Git tag: $CURRENT_TAG"
git tag -a $CURRENT_TAG -m "Release $CURRENT_TAG"

echo "Pushing tag to origin..."
git push origin $CURRENT_TAG
print_notice "Git tag created and pushed successfully"
print_end_group

print_step "📋 Create GitHub Release"
echo "Creating GitHub release for $CURRENT_TAG..."

# Get the commit message for release notes
COMMIT_MSG=$(git log -1 --pretty=%B)

# Create GitHub release
gh release create "$CURRENT_TAG" \
    --title "Release $CURRENT_TAG" \
    --notes "🚀 **Portfolio Web Release $CURRENT_TAG**

## Changes
- Version: $CURRENT_VERSION
- Docker image built and pushed to Harbor Registry
- Image available at: \`192.168.1.168:30003/frontend/portfolio-web:$CURRENT_TAG\`

## Deployment Details
- Registry: 192.168.1.168:30003
- Repository: frontend/portfolio-web
- Tags: $CURRENT_TAG, latest

## Commit Message
\`\`\`
$COMMIT_MSG
\`\`\`" \
    --latest

print_notice "GitHub release created successfully"
print_end_group

print_step "🧹 Cleanup"
echo "Cleaning up local Docker images..."
docker rmi temp-image || true
docker rmi 192.168.1.168:30003/frontend/portfolio-web:$CURRENT_TAG || true
docker rmi 192.168.1.168:30003/frontend/portfolio-web:latest || true
print_notice "Cleanup completed"
print_end_group

print_step "✅ Release Summary"
echo -e "${GREEN}🎉 Build and Release Complete!${NC}"
echo "Version: $CURRENT_TAG"
echo "Registry: 192.168.1.168:30003"
echo "Repository: frontend/portfolio-web"
echo "Tags: $CURRENT_TAG, latest"
echo "GitHub Release: https://github.com/$(gh repo view --json owner,name -q '.owner.login + \"/\" + .name')/releases/tag/$CURRENT_TAG"
print_end_group