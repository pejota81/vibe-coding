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

**Important**: The script will prompt you for **unique names** (globally unique across Azure).

You'll be asked:
- **Subscription ID**: Find in [Azure Portal](https://portal.azure.com) → Subscriptions
- **Resource Group**: Enter any name, e.g.: `vibe-coding-rg`
- **Region**: ✅ **Use `canadacentral`** (best quota availability)
  - Alternatives: `eastus2`, `centralus`, `westus`
- **App Name**: Must be **globally unique**, e.g.: `vibe-app-yourname-2026` (script auto-fixes collisions)
- **Cosmos DB Name**: Must be **globally unique**, e.g.: `vibe-cosmos-yourname-2026` (script auto-fixes collisions)

> **Note**: The script checks Azure for name availability and auto-appends a suffix if your name is taken. You can always try again with a more unique name.

Script will:
- ✅ Create Azure resources (App Service, Cosmos DB)
- ✅ Output your app URL
- ✅ Show next steps

### Step 3: Set Environment Variables (1 min)
**⚠️ CRITICAL**: These settings are **automatically configured** by the deployment script.

The script will set:
- NODE_ENV=production
- SESSION_SECRET (auto-generated random secure string)
- COSMOS_DB_* (connection details to your database)
- Build settings for Linux dependency compilation

The app **requires** these settings to start. They are already applied.

**Optional**: If you need to add Apple Sign-in or other custom settings:
```bash
RESOURCE_GROUP="vibe-coding-rg"
APP_NAME="your-app-name"  # Use the name from deployment output

az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --settings \
      APPLE_TEAM_ID="your-apple-team-id" \
      APPLE_CLIENT_ID="your-apple-client-id" \
      APPLE_KEY_ID="your-apple-key-id" \
      APPLE_PRIVATE_KEY="your-apple-private-key"
```

### Step 4: Deploy Code (3-5 min)

**ZIP Deploy (Recommended - Azure Oryx automatically compiles Linux dependencies)**
```bash
# Create deployment package (WITHOUT node_modules)
# Azure Oryx will compile dependencies for Linux during deployment
cd /Users/pejota/repos/vibe-coding
zip -r deploy.zip . -x "node_modules/*" ".git/*" ".env*" "deploy.zip"

# Deploy (takes 3-5 min - includes Linux dependency compilation)
az webapp deploy \
    --resource-group cm-rg \
    --name your-app-name \
    --src-path deploy.zip \
    --type zip
```

> ⏱️ **First deployment takes longer** - Azure compiles native dependencies (like `better-sqlite3`) for Linux, not macOS. This is normal and only happens on first deploy.

> 📌 **Important**: Do NOT include `node_modules/` in the ZIP. Let Azure compile them on Linux.

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

### Check Live Health
```bash
# Get your app URL (use the name from deployment output)
APP_URL=$(az webapp show \
    --resource-group cm-rg \
    --name your-app-name \
    --query defaultHostName -o tsv)

echo "App URL: https://$APP_URL"

# Check HTTP status
curl -I https://$APP_URL
```

### View Real-Time Logs
```bash
az webapp log tail \
    --resource-group cm-rg \
    --name your-app-name
```

### Test Your App
Open in browser: `https://your-app-url.azurewebsites.net`

You should see:
- Login page (if redirected, this is normal)
- Try login with default credentials: `admin` / `admin123`

### If App Shows 503 or Won't Start
1. Check logs: `az webapp log tail -g cm-rg -n your-app-name`
2. Common issues:
   - **"Cannot find module express"**: Wait 2-3 minutes, Azure is still compiling dependencies
   - **SESSION_SECRET not set**: Environment variables are auto-set by the Bicep template
   - See **Troubleshooting** section below

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

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| **503 Service Unavailable** | Dependencies still compiling on Azure Linux | Wait 2-3 minutes, then refresh. Check logs: `az webapp log tail -g cm-rg -n your-app-name` |
| **"Cannot find module express"** | Azure Oryx build didn't run | Ensure `SCM_DO_BUILD_DURING_DEPLOYMENT=true` in app settings. Redeploy. |
| **App won't start after 5+ min** | Process crashed during startup | Run: `az webapp log tail -g cm-rg -n your-app-name \| head -100` to see exact error |
| **Deployment name already taken** | Global uniqueness violation | Script auto-fixes this. If manual, try: `vibe-app-yourname-yyyy-randnum` |
| **Quota exceeded error** | Region has no capacity | Use `canadacentral` instead of `eastus`. Script will prompt. |
| **Environment variables not loading** | Settings not propagated | Run: `az webapp config appsettings list -g cm-rg -n your-app-name` to verify they're set |

## Cost Estimate

| Resource | Pricing | Est. Monthly |
|----------|---------|------------|
| App Service (B1) | $18.97 | $18.97 |
| Cosmos DB | $1.25 per 100 RU/s | ~$30 |
| **Total** | | **~$50** |

**Free tier includes $200 credit** (first month usually free!)

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
