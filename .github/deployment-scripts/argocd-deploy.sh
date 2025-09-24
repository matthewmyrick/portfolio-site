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

print_step "🚀 Portfolio Web ArgoCD Deployment"
echo -e "${GREEN}Starting ArgoCD deployment process...${NC}"
print_end_group

print_step "🔧 Check dependencies"
# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is required but not installed"
    echo "Please install kubectl"
    exit 1
else
    echo "kubectl is available"
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info > /dev/null 2>&1; then
    print_error "Unable to connect to Kubernetes cluster"
    echo "Please ensure you are connected to the correct cluster"
    exit 1
else
    echo "Kubernetes cluster is accessible"
fi
print_end_group

print_step "🔍 Check ArgoCD Installation"
# Check if ArgoCD is running
if ! kubectl get namespace argocd > /dev/null 2>&1; then
    print_error "ArgoCD namespace not found"
    echo "Please ensure ArgoCD is installed in the cluster"
    exit 1
fi

if ! kubectl get pods -n argocd | grep -q "Running"; then
    print_error "ArgoCD pods are not running"
    echo "Please check ArgoCD installation"
    exit 1
fi

print_notice "ArgoCD is running and accessible"
print_end_group

print_step "📦 Deploy ArgoCD Application"
echo "Applying ArgoCD application manifest..."

# Apply the ArgoCD application
kubectl apply -f ./portfolio-web/argocd/application.yaml

print_notice "ArgoCD application manifest applied successfully"
print_end_group

print_step "⏱️ Wait for Application Sync"
echo "Waiting for ArgoCD to sync the application..."

# Wait for the application to be created
sleep 5

# Check application status
if kubectl get application portfolio-web -n argocd > /dev/null 2>&1; then
    print_notice "Application created successfully"

    echo "Application status:"
    kubectl get application portfolio-web -n argocd -o wide

    echo ""
    echo "Detailed sync status:"
    kubectl describe application portfolio-web -n argocd | grep -A 10 "Status:"
else
    print_error "Application was not created successfully"
    exit 1
fi
print_end_group

print_step "🔄 Manual Sync (if needed)"
echo "To manually sync the application, run:"
echo "  kubectl patch application portfolio-web -n argocd --type merge -p '{\"operation\":{\"sync\":{\"syncStrategy\":{\"apply\":{\"force\":true}}}}}'"
echo ""
echo "Or use the ArgoCD CLI:"
echo "  argocd app sync portfolio-web"
print_end_group

print_step "🌐 Access Information"
echo "Application deployment initiated successfully!"
echo ""
echo "ArgoCD Application: portfolio-web"
echo "Namespace: portfolio-web"
echo "Target URL: https://portfolio.matthewmyrick.com"
echo ""
echo "To monitor the deployment:"
echo "  kubectl get pods -n portfolio-web"
echo "  kubectl get svc -n portfolio-web"
echo "  kubectl get ingress -n portfolio-web"
echo ""
echo "To check ArgoCD application status:"
echo "  kubectl get application portfolio-web -n argocd"
echo "  kubectl describe application portfolio-web -n argocd"
print_end_group

print_step "✅ Deployment Summary"
echo -e "${GREEN}🎉 ArgoCD Application Deployment Complete!${NC}"
echo "Application: portfolio-web"
echo "Status: Deployed to ArgoCD"
echo "Sync Policy: Automated"
echo "Target: https://portfolio.matthewmyrick.com"
print_end_group