# Portfolio Web ArgoCD Deployment

This directory contains the ArgoCD configuration for deploying the Portfolio Web application to Kubernetes.

## Files Structure

```
argocd/
├── README.md              # This file
├── application.yaml       # ArgoCD Application manifest
└── manifests/            # Kubernetes manifests
    ├── namespace.yaml    # Namespace definition
    ├── deployment.yaml   # Application deployment
    ├── service.yaml      # Service definition
    └── ingress.yaml      # Ingress configuration

.github/deployment-scripts/
└── argocd-deploy.sh      # ArgoCD deployment script
```

## Prerequisites

1. **ArgoCD installed in the cluster**
   - ArgoCD should be running in the `argocd` namespace
   - Verify with: `kubectl get pods -n argocd`

2. **kubectl configured**
   - Connected to the target Kubernetes cluster
   - Verify with: `kubectl cluster-info`

3. **Harbor Registry Access**
   - The application image is hosted at: `192.168.1.168:30003/frontend/portfolio-web`
   - Ensure the cluster has access to this registry

## Deployment Process

### Option 1: Automated Deployment Script

Run the deployment script:

```bash
./.github/deployment-scripts/argocd-deploy.sh
```

This script will:
- Check prerequisites (kubectl, cluster access, ArgoCD status)
- Deploy the ArgoCD application
- Wait for initial sync
- Provide status information

### Option 2: Manual Deployment

1. **Apply the ArgoCD Application:**
   ```bash
   kubectl apply -f application.yaml
   ```

2. **Monitor the deployment:**
   ```bash
   kubectl get application portfolio-web -n argocd
   kubectl describe application portfolio-web -n argocd
   ```

3. **Check application pods:**
   ```bash
   kubectl get pods -n portfolio-web
   ```

## Application Configuration

- **Application Name:** portfolio-web
- **Target Namespace:** portfolio-web
- **Repository:** https://github.com/matthewmyrick/portfolio-site
- **Path:** portfolio-web/argocd/manifests
- **Docker Image:** 192.168.1.168:30003/frontend/portfolio-web:latest
- **Target URL:** https://portfolio.matthewmyrick.com

## Sync Policy

The application is configured with automated sync:
- **Auto Prune:** Enabled - removes resources not defined in Git
- **Self Heal:** Enabled - automatically fixes drift
- **Create Namespace:** Enabled - creates target namespace if it doesn't exist

## Monitoring Commands

```bash
# Check ArgoCD application status
kubectl get application portfolio-web -n argocd -o wide

# View application pods
kubectl get pods -n portfolio-web

# View application services
kubectl get svc -n portfolio-web

# View ingress configuration
kubectl get ingress -n portfolio-web

# Check application logs
kubectl logs -n portfolio-web deployment/portfolio-web

# Force sync if needed
kubectl patch application portfolio-web -n argocd --type merge -p '{"operation":{"sync":{"syncStrategy":{"apply":{"force":true}}}}}'
```

## Troubleshooting

### Application Not Syncing
1. Check ArgoCD logs: `kubectl logs -n argocd deployment/argocd-application-controller`
2. Verify repository access and path configuration
3. Check if the target namespace has the required permissions

### Image Pull Issues
1. Verify Harbor registry access from the cluster
2. Check if image pull secrets are configured correctly
3. Ensure the image tag exists in the registry

### Ingress Not Working
1. Verify nginx-ingress-controller is installed
2. Check cert-manager for TLS certificate issues
3. Ensure DNS is properly configured for the domain

## Image Updates

When a new image is pushed to Harbor registry with the `latest` tag, ArgoCD will automatically detect the change and update the deployment if image pull policy allows it. For guaranteed updates, update the image tag in `manifests/deployment.yaml` and commit the change to trigger ArgoCD sync.

## Accessing the Application

Once deployed successfully, the application will be available at:
- **URL:** https://portfolio.matthewmyrick.com
- **Internal Service:** portfolio-web.portfolio-web.svc.cluster.local:80