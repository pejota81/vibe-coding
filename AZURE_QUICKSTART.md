# Quick Start: Deploy Vibe-Coding to Azure

This guide walks you through deploying your app in **15 minutes**.

## Prerequisites (5 minutes)

1. **Install Azure CLI**
   ```bash
   # macOS
   brew install azure-cli
   
   # Or download: https://docs.microsoft.com/cli/azure/install-azure-cli
   ```

2. **Create Azure Account**
   - Go to [azure.microsoft.com/free](https://azure.microsoft.com/free)
   - Sign up (you get $200 free credits)
   - Takes < 5 minutes

3. **Verify Installation**
   ```bash
   az --version        # Should show Azure CLI version
   node --version      # Should show v18 or higher
   npm --version
   ```

## Deploy to Azure (10 minutes)

### Step 1: Login (1 min)
```bash
az login
```
Opens your browser. Click "Accept" and you're done!

### Step 2: Run Deployment Script (5 min)
```bash
# Make script executable
chmod +x deploy/deploy.sh

# Run it
./deploy/deploy.sh
```

You'll be asked:
- **Subscription ID**: Find in [Azure Portal](https://portal.azure.com) → Subscriptions
- **Resource Group**: Enter: `vibe-coding-rg`
- **Region**: Enter: `eastus`
- **App Name**: Enter: `vibe-coding-app-123` (must be globally unique)
- **Cosmos DB Name**: Enter: `vibe-cosmos-123` (must be globally unique)

Script will:
- ✅ Create Azure resources (App Service, Cosmos DB)
- ✅ Output your app URL
- ✅ Show next steps

### Step 3: Set Environment Variables (2 min)
After script completes, copy this command and update values:

```bash
RESOURCE_GROUP="vibe-coding-rg"
APP_NAME="vibe-coding-app-123"

# Get Cosmos DB key
COSMOS_KEY=$(az cosmosdb keys list \
    --resource-group $RESOURCE_GROUP \
    --name vibe-cosmos-123 \
    --query primaryMasterKey -o tsv)

# Set app settings
az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --settings \
      NODE_ENV=production \
      COSMOS_DB_ENDPOINT=https://vibe-cosmos-123.documents.azure.com:443/ \
      COSMOS_DB_KEY="$COSMOS_KEY" \
      COSMOS_DB_DATABASE=vibe_coding \
      SESSION_SECRET=$(openssl rand -base64 32) \
      JWT_SECRET=$(openssl rand -base64 32)
```

### Step 4: Deploy Code (2 min)

**Option A: ZIP Deploy (Fastest)**
```bash
# Build production bundle
npm install --production

# Create ZIP
zip -r deploy.zip . -x "node_modules/*" ".git/*" ".env*"

# Deploy
az webapp deployment source config-zip \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app-123 \
    --src deploy.zip
```

**Option B: Git Deploy (Best for CI/CD)**
```bash
# Get publish profile
az webapp deployment list-publishing-profiles \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app-123 \
    --xml > PublishSettings.xml

# Add Azure remote
git remote add azure https://<app-name>.scm.azurewebsites.net/<app-name>.git

# Push to deploy
git push azure main
```

## Verify Deployment

### Check App Status
```bash
# Get your app URL
az webapp show \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app-123 \
    --query defaultHostName -o tsv
```

### View Live Logs
```bash
az webapp log tail \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app-123
```

### Visit Your App
Open in browser:
```
https://vibe-coding-app-123.azurewebsites.net
```

## Add Apple Sign-in (Optional)

If you want to use Apple OAuth, add these environment variables:

```bash
az webapp config appsettings set \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app-123 \
    --settings \
      APPLE_TEAM_ID="your-team-id" \
      APPLE_CLIENT_ID="your-client-id" \
      APPLE_KEY_ID="your-key-id" \
      APPLE_PRIVATE_KEY="your-private-key"
```

## Migrate SQLite Data (Optional)

If you have existing data in SQLite, migrate it:

```bash
# First, set up Cosmos DB connection
export COSMOS_DB_ENDPOINT="https://vibe-cosmos-123.documents.azure.com:443/"
export COSMOS_DB_KEY="your-key"
export COSMOS_DB_DATABASE="vibe_coding"

# Run migration
npm run migrate:cosmos
```

## Enable Auto-Deployment with GitHub

1. Get your publish profile:
   ```bash
   az webapp deployment list-publishing-profiles \
       --resource-group vibe-coding-rg \
       --name vibe-coding-app-123 \
       --xml
   ```

2. Add as GitHub secret `AZURE_PUBLISH_PROFILE`

3. Workflow automatically deploys on push to `main` branch!

## Cost Estimate

| Resource | Pricing | Est. Monthly |
|----------|---------|-------------|
| App Service (B1) | $18.97 | $18.97 |
| Cosmos DB | $1.25 per 100 RU/s | ~$30 |
| **Total** | | **~$50** |

*Use free tier grants ($200 credit) to get started!*

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot find module" | Run `npm install --production` before deploying |
| 502 Bad Gateway | Check logs: `az webapp log tail --resource-group ... --name ...` |
| Cosmos DB connection fails | Verify keys and firewall settings in Azure Portal |
| High costs | Reduce Cosmos DB throughput or use Azure Free Tier |

## Next Steps

- 📚 **Full Documentation**: See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md)
- 🔍 **Monitor**: Set up Application Insights for performance monitoring
- 🔐 **Security**: Enable managed identity and remove connection strings
- 🚀 **Scale**: Auto-scale App Service and Cosmos DB as needed

## Need Help?

- [Azure Documentation](https://docs.microsoft.com/azure/)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/)
- [Cosmos DB Help](https://docs.microsoft.com/azure/cosmos-db/)
- GitHub Issues: [report a bug](https://github.com/pejota81/vibe-coding/issues)

---

**Happy deploying! 🚀**
