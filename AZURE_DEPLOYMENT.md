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

⚠️ **IMPORTANT**: The Bicep template automatically sets:
- `NODE_ENV=production`
- `SESSION_SECRET` (required - app won't start without it)
- `COSMOS_DB_ENDPOINT`, `COSMOS_DB_KEY`, `COSMOS_DB_DATABASE`
- **Build settings**: `SCM_DO_BUILD_DURING_DEPLOYMENT=true`, `ENABLE_ORYX_BUILD=true`

These are **already configured** by `deploy/main.bicep`. No manual setup needed.

### Optional: Add Apple Sign-In Settings

If you want to enable Apple OAuth Sign-In:

```bash
# Get your Cosmos DB key for reference (already in app settings)
COSMOS_KEY=$(az cosmosdb keys list \
    --resource-group vibe-coding-rg \
    --name vibe-coding-cosmos \
    --query primaryMasterKey -o tsv)

# Add Apple OAuth settings
az webapp config appsettings set \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --settings \
      APPLE_TEAM_ID="your-apple-team-id" \
      APPLE_CLIENT_ID="your-apple-client-id" \
      APPLE_KEY_ID="your-apple-key-id" \
      APPLE_PRIVATE_KEY="your-apple-private-key"
```

### Verify All Settings

```bash
az webapp config appsettings list \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --query "[?name starts with 'NODE' or name starts with 'COSMOS' or name starts with 'SESSION' or name starts with 'SCM'].{name:name, value:value}" \
    -o table
```

## Step 5: Build and Deploy Application Code

### ⚠️ CRITICAL: Understand Linux Native Dependencies

The app uses **native C++ modules** (`better-sqlite3`) which must be compiled for **Linux**, not macOS.

✅ **CORRECT**: Create ZIP **without** `node_modules` → Azure compiles them for Linux

❌ **WRONG**: Include macOS-compiled `node_modules` → App crashes: "Cannot find module"

---

### Option A: Deploy via ZIP File (Recommended - 3-5 min, includes build)

```bash
# 1. Go to project root
cd /path/to/vibe-coding

# 2. Create deployment package WITHOUT node_modules
# Azure Oryx will compile dependencies for Linux on-server
zip -r deploy.zip . \
  -x "node_modules/*" ".git/*" ".env*" "deploy.zip"

# 3. Deploy (Azure builds on Linux)
az webapp deploy \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --src-path deploy.zip \
    --type zip

# First deployment takes 3-5 min (includes npm install on Linux)
# Subsequent deployments are faster
```

**Why this takes longer on first deploy**:
- Azure Oryx detects `package.json`
- Runs `npm install --production` on Linux
- Compiles native modules (better-sqlite3) for Linux
- Starts your app

This is normal and only happens once per redeployment.

### Option B: Deploy with GitHub Actions (Recommended for CI/CD)

Automatically redeploys on every push to `main`:

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
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Deploy to App Service
        uses: azure/webapps-deploy@v2
        with:
          app-name: ${{ env.AZURE_APP_NAME }}
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
          package: .
```

**Setup** (one-time):
1. Get publish profile:
   ```bash
   az webapp deployment list-publishing-profiles \
       --resource-group vibe-coding-rg \
       --name vibe-coding-app \
       --xml
   ```
2. Add to GitHub:
   - Repo Settings → Secrets → New secret
   - Name: `AZURE_PUBLISH_PROFILE`
   - Value: Paste the XML
3. Next push to `main` auto-deploys!

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

## Step 6: Verify Deployment & Troubleshoot

### Check Deployment Status

```bash
# Get your app's actual URL
az webapp show \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --query defaultHostName -o tsv

# Check if app is running
az webapp show \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --query state
```

### Stream Live Logs (Best for Troubleshooting)

```bash
az webapp log tail \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app
```

Look for:
- ✅ "Server running on" → App started successfully
- ❌ "Cannot find module" → Wait 2-3 min, Oryx is still compiling
- ❌ "ERROR" in red → See **Common Issues** section below

### Visit Your App

Once logs show success:
```
https://vibe-coding-app.azurewebsites.net
```

Default login credentials:
- Username: `admin`
- Password: `admin123`

---

## Common Issues & Solutions

### 1. "Cannot find module 'express'" (503 Error)

**What**: App crashes on startup

**Why**: Azure is still compiling dependencies on Linux (Oryx build in progress)

**Fix**: Wait 2-5 minutes and refresh the page

```bash
# Monitor progress
az webapp log tail -g vibe-coding-rg -n vibe-coding-app | grep -E "npm|install|Building"
```

### 2. App Shows 503 After 10+ Minutes

**Why**: Something failed during startup

**Debug**:
```bash
# Check logs for error
az webapp log tail -g vibe-coding-rg -n vibe-coding-app | head -100

# Restart app
az webapp restart -g vibe-coding-rg -n vibe-coding-app

# Wait 30 sec and check again
```

### 3. Deployment Name Already Taken

**Why**: App Service or Cosmos DB names must be globally unique

**Fix**: Use a more unique name

```bash
# Try names like:
vibe-app-yourname-2026
vibe-cosmos-yourname-2026
# Or let the script auto-fix it
```

### 4. Region Has No Quota (\"SubscriptionIsOverQuotaForSku\")

**Why**: `eastus` is out of capacity

**Fix**: Use a different region

```bash
# Recommended regions (usually have capacity):
canadacentral    # Best availability
eastus2          # Alternative East US
centralus        # Central US
westus           # West US
```

Re-run deployment script and try a different region.

### 5. Environment Variables Not Loading

**Verify** they're set:
```bash
az webapp config appsettings list \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --query "[?name=='SESSION_SECRET' || name=='NODE_ENV'].{name, value}" \
    -o table
```

If missing, manually set:
```bash
az webapp config appsettings set \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --settings \
      NODE_ENV=production \
      SESSION_SECRET=$(openssl rand -base64 32)
```

## Optional: Cosmos DB Data Migration (For Production)

If you have existing data in SQLite, migrate it to Cosmos DB:

```bash
# First, set Cosmos DB credentials
export COSMOS_DB_ENDPOINT=https://vibe-cosmos-xxx.documents.azure.com:443/
export COSMOS_DB_KEY=$(az cosmosdb keys list \
    --resource-group vibe-coding-rg \
    --name vibe-cosmos-xxx \
    --query primaryMasterKey -o tsv)
export COSMOS_DB_DATABASE=vibe_coding

# Run migration (reads SQLite, writes to Cosmos DB)
node scripts/migrate-to-cosmos.js
```

The script:
1. Reads all tables from local SQLite (`data/app.db`)
2. Transforms to Cosmos DB document format
3. Uploads to Azure Cosmos DB
4. Reports count of documents migrated

## Performance & Optimization

### First Deployment Takes Longer

- **3-5 minutes** = normal (Azure compiles native dependencies for Linux)
- Includes: `npm install`, native module compilation (better-sqlite3), app startup

### Subsequent Deployments

- **1-2 minutes** = faster (dependencies cached, only code updated)

### If Still Slow After 5+ Minutes

```bash
# Check if process is still compiling
az webapp log tail -g vibe-coding-rg -n vibe-coding-app | tail -50

# Restart if stuck
az webapp restart -g vibe-coding-rg -n vibe-coding-app

# Wait 2 min and check again
curl -I https://vibe-coding-app.azurewebsites.net
```

## App Service Plan Upgrade (If Slow)

```bash
# Current plan info
az appservice plan show -g vibe-coding-rg -n vibe-coding-app-plan --query sku

# Upgrade to S1 (Standard) for auto-scaling
az appservice plan update -g vibe-coding-rg -n vibe-coding-app-plan --sku S1

# This enables auto-scale rules
```

## Cosmos DB Throughput

```bash
# Update throughput (RU/s)
az cosmosdb sql container throughput update \
    --resource-group vibe-coding-rg \
    --account-name vibe-coding-cosmos \
    --database-name vibe_coding \
    --name items \
    --throughput 1000
```

## Cleanup & Monitoring

### Monitor Costs

```bash
# Get estimated costs in Azure Portal
echo "View costs: https://portal.azure.com → Cost Management"

# Check resource group size
az group show --name vibe-coding-rg --query "properties.state" -o tsv
```

### Delete All Resources (When Done)

⚠️ **WARNING**: This deletes everything and cannot be undone

```bash
az group delete --name vibe-coding-rg --yes
```

Verify deletion:
```bash
az group list --query "[?name=='vibe-coding-rg']" -o table
# Should return empty
```

## Support

For issues or questions:
- [Azure Documentation](https://docs.microsoft.com/azure/)
- [App Service on Linux](https://docs.microsoft.com/azure/app-service/)
- [Cosmos DB Documentation](https://docs.microsoft.com/azure/cosmos-db/)
- [Troubleshooting App Service](https://docs.microsoft.com/azure/app-service/troubleshoot-common-errors)
