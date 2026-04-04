# Azure Deployment Guide for Vibe-Coding

This guide walks you through deploying your Express.js app to Azure App Service with Cosmos DB.

## Prerequisites

- **Azure CLI**: [Install from here](https://docs.microsoft.com/cli/azure/install-azure-cli)
- **Node.js 18+**: [Download from nodejs.org](https://nodejs.org/)
- **Active Azure Subscription**: [Create a free account](https://azure.microsoft.com/free/)

## Step 1: Install Azure CLI

```bash
# macOS
brew install azure-cli

# Or download from: https://docs.microsoft.com/cli/azure/install-azure-cli
```

Verify installation:
```bash
az --version
```

## Step 2: Login to Azure

```bash
az login
```

This opens your browser to authenticate with Azure. You'll need to:
1. Sign in with your Microsoft account
2. Accept permissions
3. Return to terminal

## Step 3: Create Azure Resources

We'll use Bicep (Infrastructure as Code) to create:
- App Service Plan (B1 - Basic)
- App Service (Node.js 18 LTS)
- Cosmos DB Account
- Cosmos DB Database & Container

### Option A: Automated Deployment (Recommended)

```bash
# Make deployment script executable
chmod +x deploy/deploy.sh

# Run deployment
./deploy/deploy.sh
```

The script will:
1. Prompt for subscription ID, resource group, region, app name, and Cosmos DB account name
2. Create the resource group
3. Deploy infrastructure via Bicep
4. Output your app URL and Cosmos DB endpoint

### Option B: Manual Deployment

```bash
# Set variables
SUBSCRIPTION_ID="your-subscription-id"
RESOURCE_GROUP="vibe-coding-rg"
LOCATION="eastus"
APP_NAME="vibe-coding-app"
COSMOS_ACCOUNT="vibe-coding-cosmos"

# Set subscription
az account set --subscription "$SUBSCRIPTION_ID"

# Create resource group
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION"

# Deploy infrastructure
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file deploy/main.bicep \
    --parameters appName="$APP_NAME" cosmosDbAccountName="$COSMOS_ACCOUNT"
```

## Step 4: Configure Environment Variables

Get your Cosmos DB connection string:

```bash
COSMOS_KEY=$(az cosmosdb keys list \
    --resource-group vibe-coding-rg \
    --name vibe-coding-cosmos \
    --query primaryMasterKey -o tsv)

echo "Cosmos DB Key: $COSMOS_KEY"
```

Set environment variables in App Service:

```bash
az webapp config appsettings set \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --settings \
        NODE_ENV=production \
        COSMOS_DB_ENDPOINT=https://vibe-coding-cosmos.documents.azure.com:443/ \
        COSMOS_DB_KEY="$COSMOS_KEY" \
        COSMOS_DB_DATABASE=vibe_coding \
        APPLE_TEAM_ID="your-apple-team-id" \
        APPLE_CLIENT_ID="your-apple-client-id" \
        APPLE_KEY_ID="your-apple-key-id" \
        APPLE_PRIVATE_KEY="your-apple-private-key" \
        SESSION_SECRET="generate-a-random-session-secret"
```

## Step 5: Build and Deploy Application Code

### Option A: Deploy with GitHub Actions (Recommended for CI/CD)

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [ main ]

env:
  AZURE_APP_NAME: vibe-coding-app
  RESOURCE_GROUP: vibe-coding-rg

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build || true
      
      - name: Deploy to App Service
        uses: azure/webapps-deploy@v2
        with:
          app-name: ${{ env.AZURE_APP_NAME }}
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
          package: .
```

To set up GitHub secrets:

1. Get publish profile:
```bash
az webapp deployment list-publishing-profiles \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --xml
```

2. Copy output and add to GitHub repository secrets as `AZURE_PUBLISH_PROFILE`

### Option B: Deploy via ZIP File

```bash
# Build your app (if needed)
npm install --production

# Create deployment package
zip -r deploy.zip . -x "node_modules/*" ".git/*" ".env*"

# Deploy
az webapp deployment source config-zip \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --src deploy.zip
```

### Option C: Direct Git Deploy

```bash
# Enable Git deployment
az webapp deployment source config-local-git \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app

# Add Azure remote and push
git remote add azure https://<app-name>.scm.azurewebsites.net/<app-name>.git
git push azure main
```

## Step 6: Verify Deployment

Check app status:
```bash
az webapp show \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --query defaultHostName
```

View logs:
```bash
az webapp log tail \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app
```

Visit your app:
```
https://vibe-coding-app.azurewebsites.net
```

## Cosmos DB Database Migration

Your SQLite data needs to be migrated to Cosmos DB. The new database layer supports both:

### Migrating Data

```bash
# Run migration script
node scripts/migrate-to-cosmos.js
```

This script will:
1. Read data from SQLite
2. Transform documents for Cosmos DB format
3. Upload to Cosmos DB
4. Verify migration success

## Monitoring and Troubleshooting

### View Application Insights

```bash
# Enable Application Insights
az monitor app-insights component create \
    --app vibe-coding-insights \
    --location eastus \
    --resource-group vibe-coding-rg
```

### Check App Service Logs

```bash
# Enable detailed logging
az webapp log config \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --detailed-error-messages true \
    --failed-request-tracing true

# Stream live logs
az webapp log stream \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Module not found" | Run `npm install --production` before deployment |
| 502 Bad Gateway | Check logs: `az webapp log stream --resource-group ... --name ...` |
| Cosmos DB connection fails | Verify connection string and firewall settings |
| Environment variables not loading | Check app settings with `az webapp config appsettings list` |

## Scaling and Cost Optimization

### Auto-scalable App Service Plan

```bash
# Switch to S1 (Standard) for auto-scaling
az appservice plan update \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app-plan \
    --sku S1

# Configure auto-scale
az monitor autoscale create \
    --resource-group vibe-coding-rg \
    --resource vibe-coding-app-plan \
    --resource-type "Microsoft.Web/serverfarms" \
    --min-count 1 \
    --max-count 5 \
    --resource-group-name vibe-coding-rg \
    --scale-rule-type PercentCPU \
    --scale-rule-operator GreaterThan \
    --scale-rule-threshold 70 \
    --scale-rule-duration 5m
```

### Cosmos DB Throughput

```bash
# Update throughput (RU/s)
az cosmosdb sql container throughput update \
    --resource-group vibe-coding-rg \
    --account-name vibe-coding-cosmos \
    --database-name vibe_coding \
    --name items \
    --throughput 1000
```

## Clean Up Resources

When done, delete all resources:

```bash
az group delete --name vibe-coding-rg --yes
```

## Support

For issues or questions:
- [Azure Documentation](https://docs.microsoft.com/azure/)
- [App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Cosmos DB Documentation](https://docs.microsoft.com/azure/cosmos-db/)
