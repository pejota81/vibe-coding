#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Azure Deployment Script for Vibe-Coding${NC}"
echo -e "${BLUE}========================================${NC}"

# Check prerequisites
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI not found. Install it from https://docs.microsoft.com/cli/azure${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: Node.js/npm not found. Install it from https://nodejs.org/${NC}"
    exit 1
fi

# Get configuration inputs
read -p "Enter Azure subscription ID: " SUBSCRIPTION_ID
read -p "Enter resource group name (e.g., vibe-coding-rg): " RESOURCE_GROUP
read -p "Enter Azure region (e.g., eastus): " LOCATION
read -p "Enter App Service name (e.g., vibe-coding-app): " APP_NAME
read -p "Enter Cosmos DB account name (e.g., vibe-coding-cosmos): " COSMOS_ACCOUNT

echo -e "${BLUE}\nStep 1: Setting up Azure subscription...${NC}"
az account set --subscription "$SUBSCRIPTION_ID"

echo -e "${BLUE}\nStep 2: Creating resource group...${NC}"
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION"

echo -e "${BLUE}\nStep 3: Deploying infrastructure with Bicep...${NC}"
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file deploy/main.bicep \
    --parameters appName="$APP_NAME" cosmosDbAccountName="$COSMOS_ACCOUNT"

echo -e "${GREEN}\n✓ Infrastructure deployed successfully!${NC}"

echo -e "${BLUE}\nStep 4: Getting deployment outputs...${NC}"
APP_URL=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name main \
    --query properties.outputs.appServiceUrl.value -o tsv)

COSMOS_ENDPOINT=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name main \
    --query properties.outputs.cosmosDbEndpoint.value -o tsv)

echo -e "${GREEN}\n✓ Deployment Complete!${NC}"
echo -e "\n${BLUE}Deployment Details:${NC}"
echo -e "  App URL: ${GREEN}https://${APP_URL}${NC}"
echo -e "  Cosmos DB Endpoint: ${GREEN}${COSMOS_ENDPOINT}${NC}"
echo -e "  Resource Group: ${GREEN}${RESOURCE_GROUP}${NC}"

echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "  1. Configure App Service environment variables:"
echo -e "     ${BLUE}az webapp config appsettings set --resource-group ${RESOURCE_GROUP} --name ${APP_NAME} --settings APPLE_TEAM_ID=<value> APPLE_CLIENT_ID=<value> APPLE_KEY_ID=<value> APPLE_PRIVATE_KEY=<value>${NC}"
echo -e "  2. Build and deploy the app:"
echo -e "     ${BLUE}npm run build${NC}"
echo -e "     ${BLUE}npm run deploy${NC}"
echo -e "  3. Visit your app at: ${GREEN}https://${APP_URL}${NC}"

echo -e "\n${BLUE}Deployment script completed!${NC}"
