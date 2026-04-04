# Azure Deployment Quick Start

## 🚀 5-Minute Setup

### 1. Install Azure CLI
```bash
brew install azure-cli
az login
```

### 2. Run Deployment Script
```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

Follow prompts:
- **Subscription ID**: Your Azure subscription (get with `az account list`)
- **Resource Group**: vibe-coding-rg (or choose your own)
- **Region**: eastus (or your preferred region)
- **App Name**: vibe-coding-app (or choose your own)
- **Cosmos DB Account**: vibe-coding-cosmos (or choose your own)

### 3. Configure Environment Variables
```bash
RESOURCE_GROUP="vibe-coding-rg"
APP_NAME="vibe-coding-app"

# Get Cosmos DB key
COSMOS_KEY=$(az cosmosdb keys list \
    --resource-group $RESOURCE_GROUP \
    --name vibe-coding-cosmos \
    --query primaryMasterKey -o tsv)

# Set app settings
az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --settings \
        NODE_ENV=production \
        COSMOS_DB_ENDPOINT=https://vibe-coding-cosmos.documents.azure.com:443/ \
        COSMOS_DB_KEY="$COSMOS_KEY" \
        COSMOS_DB_DATABASE=vibe_coding \
        SESSION_SECRET=$(openssl rand -hex 32) \
        APPLE_TEAM_ID="your-team-id" \
        APPLE_CLIENT_ID="your-client-id" \
        APPLE_KEY_ID="your-key-id" \
        APPLE_PRIVATE_KEY="your-private-key"
```

Replace the Apple OAuth values with your actual credentials.

### 4. Deploy Application
```bash
# Prepare deployment
npm install --production

# Migrate data from SQLite to Cosmos DB (if existing data)
node scripts/migrate-to-cosmos.js

# Deploy via ZIP
zip -r deploy.zip . -x "node_modules/*" ".git/*" ".env*"
az webapp deployment source config-zip \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --src deploy.zip
```

### 5. Visit Your App
```bash
# Get app URL
az webapp show \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --query defaultHostName -o tsv

# Open in browser
open https://vibe-coding-app.azurewebsites.net
```

---

## 📋 What Got Created?

✅ **Infrastructure (Bicep)**
- App Service Plan (B1 - Basic, $12.50/month)
- App Service (Node.js 18 LTS)
- Cosmos DB Account (400 RU/s, $24/month)
- Cosmos DB Database & Container
- Storage for app files
- Managed identity for security

✅ **Configuration Files**
- `deploy/main.bicep` - Infrastructure as Code
- `deploy/deploy.sh` - Automated deployment
- `AZURE_DEPLOYMENT.md` - Detailed guide
- `.env.example` - Environment variables template
- `web.config` - App Service routing config
- `.github/workflows/azure-deploy.yml` - CI/CD pipeline

✅ **Database**
- `src/config/cosmos-db.js` - Cosmos DB client
- `scripts/migrate-to-cosmos.js` - SQLite → Cosmos DB migration

---

## 🔑 Set Up GitHub Actions (Optional)

Enables automatic deployment on every push to `main`:

1. **Get Publish Profile:**
```bash
az webapp deployment list-publishing-profiles \
    --resource-group vibe-coding-rg \
    --name vibe-coding-app \
    --xml
```

2. **Add GitHub Secrets:**
   - Go to repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `AZURE_PUBLISH_PROFILE`
   - Value: Paste entire XML from step 1

3. **Push to main branch:**
   - Workflow automatically triggers
   - App deploys within 2-3 minutes

---

## 💾 Database Migration

### Option 1: SQLite (Development)
- Already configured for local testing
- No setup needed
- Good for feature development

### Option 2: Cosmos DB (Production)
Use the migration script:

```bash
# Run migration
node scripts/migrate-to-cosmos.js

# Verify data in Azure Portal
# https://portal.azure.com → Cosmos DB → Data Explorer
```

---

## 📊 Monitoring

Check app health:
```bash
# View logs
az webapp log tail --resource-group vibe-coding-rg --name vibe-coding-app

# Check status
az webapp show --resource-group vibe-coding-rg --name vibe-coding-app --query "{State:state, Url:defaultHostName}"

# Restart if needed
az webapp restart --resource-group vibe-coding-rg --name vibe-coding-app
```

---

## 💰 Cost Breakdown (Monthly)

| Resource | SKU | Cost |
|----------|-----|------|
| App Service Plan | B1 (Basic) | $12.50 |
| Cosmos DB | 400 RU/s | $24.00 |
| Storage | Pay per GB | ~$5.00 (est.) |
| **Total** | | **~$41.50** |

Upgrade to S1+ App Service for auto-scaling (starts at $50/month).

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| 502 Bad Gateway | Check logs: `az webapp log tail ...` |
| Cosmos DB connection error | Verify key and endpoint in settings |
| "Module not found" | Ensure `.zip` includes `node_modules/` |
| App won't start | Check `package.json` and `main: src/server.js` |
| Slow performance | Increase Cosmos DB throughput or upgrade App Service |

---

## 📚 Additional Resources

- [Azure App Service Docs](https://docs.microsoft.com/azure/app-service/)
- [Cosmos DB Best Practices](https://docs.microsoft.com/azure/cosmos-db/best-practices)
- [Bicep Documentation](https://docs.microsoft.com/azure/azure-resource-manager/bicep/)
- [Node.js on Azure](https://azure.microsoft.com/develop/nodejs/)

---

## ❓ Next Steps

1. ✅ Run `./deploy/deploy.sh`
2. ✅ Configure environment variables
3. ✅ Deploy application code
4. ✅ Set up GitHub Actions (optional)
5. ✅ Monitor and maintain

**Need help?** See `AZURE_DEPLOYMENT.md` for detailed instructions.
