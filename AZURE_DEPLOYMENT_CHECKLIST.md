# Azure Deployment Checklist

Use this checklist to track your deployment progress.

## Pre-Deployment ✓

### Prerequisites
- [ ] Azure CLI installed (`az --version`)
- [ ] Azure account created with active subscription
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Git configured with GitHub

### Preparation
- [ ] Read [AZURE_QUICKSTART.md](./AZURE_QUICKSTART.md) (5 min)
- [ ] Clone repository and navigate to folder
- [ ] Review [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) for options
- [ ] Copy `.env.example` to `.env` (for local testing)

---

## Step 1: Azure Login

- [ ] Run `az login`
- [ ] Authenticate in browser window
- [ ] Verify with `az account list` (shows subscriptions)
- [ ] Note your **Subscription ID**

---

## Step 2: Deploy Infrastructure

### Option A: Automated (Recommended)
- [ ] Make script executable: `chmod +x deploy/deploy.sh`
- [ ] Run script: `./deploy/deploy.sh`
- [ ] Enter when prompted:
  - [ ] Subscription ID from Step 1
  - [ ] Resource Group name (e.g., `vibe-coding-rg`)
  - [ ] Region (e.g., `eastus`)
  - [ ] App Service name (e.g., `vibe-coding-app-ABC`)
  - [ ] Cosmos DB name (e.g., `vibe-cosmos-ABC`)
- [ ] **Save outputs** (app URL, Cosmos endpoint)

### Option B: Manual Deployment
- [ ] Create resource group:
  ```bash
  az group create --name vibe-coding-rg --location eastus
  ```
- [ ] Deploy Bicep template:
  ```bash
  az deployment group create \
      --resource-group vibe-coding-rg \
      --template-file deploy/main.bicep \
      --parameters appName=vibe-coding-app cosmosDbAccountName=vibe-cosmos
  ```
- [ ] **Save outputs** (app URL, Cosmos endpoint)

---

## Step 3: Configure Environment Variables

- [ ] Get Cosmos DB connection key:
  ```bash
  az cosmosdb keys list \
      --resource-group vibe-coding-rg \
      --name vibe-cosmos \
      --query primaryMasterKey -o tsv
  ```
- [ ] Copy the key (you'll need it in next step)
- [ ] Set app settings:
  ```bash
  az webapp config appsettings set \
      --resource-group vibe-coding-rg \
      --name vibe-coding-app \
      --settings \
        NODE_ENV=production \
        COSMOS_DB_ENDPOINT=<your-endpoint-from-step-2> \
        COSMOS_DB_KEY=<key-from-above> \
        COSMOS_DB_DATABASE=vibe_coding \
        SESSION_SECRET=$(openssl rand -base64 32) \
        JWT_SECRET=$(openssl rand -base64 32)
  ```

### Optional: Add Apple Sign-in
- [ ] Have Apple Developer credentials ready
- [ ] Set additional environment variables:
  ```bash
  az webapp config appsettings set \
      --resource-group vibe-coding-rg \
      --name vibe-coding-app \
      --settings \
        APPLE_TEAM_ID=your-value \
        APPLE_CLIENT_ID=your-value \
        APPLE_KEY_ID=your-value \
        APPLE_PRIVATE_KEY=your-value
  ```

---

## Step 4: Prepare Application Code

### Install Dependencies
- [ ] Run: `npm install --production`
- [ ] Verify no errors

### Optional: Migrate Data
If you have existing SQLite data:
- [ ] Set Cosmos DB environment variables in `.env`
- [ ] Run: `node scripts/migrate-to-cosmos.js`
- [ ] Verify in Azure Portal (Data Explorer)

### Create Deployment Package
- [ ] Create ZIP: `zip -r deploy.zip . -x "node_modules/*" ".git/*" ".env*"`
- [ ] Verify ZIP file created (~10-50MB typical)

---

## Step 5: Deploy Code to Azure

### Option A: ZIP Deploy (Fastest)
- [ ] Deploy: 
  ```bash
  az webapp deployment source config-zip \
      --resource-group vibe-coding-rg \
      --name vibe-coding-app \
      --src deploy.zip
  ```
- [ ] Wait 2-5 minutes for deployment
- [ ] ✓ Done!

### Option B: Git Deploy
- [ ] Get publish profile:
  ```bash
  az webapp deployment list-publishing-profiles \
      --resource-group vibe-coding-rg \
      --name vibe-coding-app \
      --xml > ~/.azure_publish.xml
  ```
- [ ] Add Azure remote: `git remote add azure <url-from-publish-profile>`
- [ ] Push: `git push azure main`
- [ ] Wait 3-5 minutes

### Option C: GitHub Actions (CI/CD)
- [ ] Add `AZURE_PUBLISH_PROFILE` secret to GitHub repo
- [ ] Push to `main` branch
- [ ] Workflow triggers automatically
- [ ] Deployed within 2-3 minutes

---

## Step 6: Verify Deployment

- [ ] Get app URL:
  ```bash
  az webapp show \
      --resource-group vibe-coding-rg \
      --name vibe-coding-app \
      --query defaultHostName -o tsv
  ```
- [ ] Visit: `https://your-app-url.azurewebsites.net`
- [ ] See login page → ✓ Success!
- [ ] Try login with default credentials (admin/admin123)

### Troubleshooting
- [ ] Check logs: `az webapp log tail --resource-group vibe-coding-rg --name vibe-coding-app`
- [ ] Restart if needed: `az webapp restart --resource-group vibe-coding-rg --name vibe-coding-app`
- [ ] See: [AZURE_DEPLOYMENT.md troubleshooting](./AZURE_DEPLOYMENT.md#troubleshooting)

---

## Step 7: Post-Deployment Configuration (Optional)

### Enable CI/CD
- [ ] Add GitHub secrets (`AZURE_PUBLISH_PROFILE`)
- [ ] Future pushes auto-deploy

### Custom Domain
- [ ] [ ] Register domain or get DNS info for existing domain
- [ ] [ ] Bind domain in App Service
- [ ] [ ] Configure SSL certificate (Azure auto-manages)

### Monitoring
- [ ] [ ] Set up Application Insights
- [ ] [ ] Create alerts for high CPU/memory
- [ ] [ ] Enable detailed logging

### Scaling
- [ ] [ ] Monitor app performance for 1 week
- [ ] [ ] Upgrade App Service SKU if needed (S1+)
- [ ] [ ] Configure auto-scaling rules

---

## Cost Management

- [ ] [ ] Set spending limit: [Azure Portal](https://portal.azure.com) → Cost Management
- [ ] [ ] Monitor Cosmos DB throughput (may auto-scale)
- [ ] [ ] Consider reserved instances for long-term use
- [ ] Estimated monthly cost: **$37-52**

---

## Maintenance

### Daily/Weekly
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify backups are running

### Monthly
- [ ] Review Azure costs
- [ ] Check for security updates
- [ ] Update dependencies: `npm update`
- [ ] Review Cosmos DB usage

### Quarterly
- [ ] Update Node.js runtime if needed
- [ ] Review and optimize Cosmos DB indexes
- [ ] Audit access and permissions
- [ ] Test disaster recovery plan

---

## Clean Up (If Needed)

To delete all Azure resources and stop charges:

```bash
az group delete --name vibe-coding-rg --yes
```

**Warning**: This deletes everything including databases!

---

## Success! 🎉

Your app is now live on Azure!

- **Public URL**: `https://vibe-coding-app.azurewebsites.net`
- **Admin URL**: `https://vibe-coding-app.azurewebsites.net/login`
- **Dashboard**: [Azure Portal](https://portal.azure.com)
- **Logs**: `az webapp log tail --resource-group vibe-coding-rg --name vibe-coding-app`

### Next Steps
1. Share your app URL with users
2. Set up custom domain (optional)
3. Configure email notifications
4. Set up monitoring alerts
5. Plan for scaling as needed

---

**Questions?** See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) for detailed help.
