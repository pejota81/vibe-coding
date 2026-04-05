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

echo -e "${BLUE}\nStep 1.0: Validating App Service name...${NC}"

# Normalize for App Service naming rules.
BASE_APP_NAME=$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g' | sed 's/^-*//' | sed 's/-*$//')
BASE_APP_NAME=${BASE_APP_NAME:0:48}

if [[ -z "$BASE_APP_NAME" ]]; then
    BASE_APP_NAME="vibeapp"
fi

check_webapp_name_available() {
    local name="$1"
    local available

    available=$(az rest \
        --method post \
        --url "https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/providers/Microsoft.Web/checkNameAvailability?api-version=2023-12-01" \
        --body "{\"name\":\"${name}\",\"type\":\"Microsoft.Web/sites\"}" \
        --query nameAvailable -o tsv 2>/dev/null || true)

    if [[ "$available" == "true" ]]; then
        echo "true"
    else
        echo "false"
    fi
}

APP_AVAILABLE=$(check_webapp_name_available "$BASE_APP_NAME")
if [[ "$APP_AVAILABLE" == "true" ]]; then
    APP_NAME="$BASE_APP_NAME"
else
    echo -e "${BLUE}App Service name '${BASE_APP_NAME}' is already taken globally.${NC}"
    FOUND_APP_NAME=""

    for _ in {1..15}; do
        RANDOM_SUFFIX=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 6)
        CANDIDATE_APP="${BASE_APP_NAME}-${RANDOM_SUFFIX}"
        CANDIDATE_APP=${CANDIDATE_APP:0:60}
        CANDIDATE_APP=$(echo "$CANDIDATE_APP" | sed 's/-*$//')

        CANDIDATE_APP_AVAILABLE=$(check_webapp_name_available "$CANDIDATE_APP")
        if [[ "$CANDIDATE_APP_AVAILABLE" == "true" ]]; then
            FOUND_APP_NAME="$CANDIDATE_APP"
            break
        fi
    done

    if [[ -z "$FOUND_APP_NAME" ]]; then
        echo -e "${RED}Error: Could not find an available App Service name automatically after multiple attempts.${NC}"
        echo -e "${RED}Please re-run and provide a longer unique app base name (example: vibe-app-yourname-2026).${NC}"
        exit 1
    fi

    APP_NAME="$FOUND_APP_NAME"
    echo -e "${BLUE}Using available app name: '${APP_NAME}'${NC}"
fi

echo -e "${BLUE}\nStep 1.1: Validating Cosmos DB account name...${NC}"

# Normalize for Cosmos naming rules: lowercase letters, numbers, and hyphens (max 44 chars).
BASE_COSMOS_NAME=$(echo "$COSMOS_ACCOUNT" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g' | sed 's/^-*//' | sed 's/-*$//')
BASE_COSMOS_NAME=${BASE_COSMOS_NAME:0:34}

if [[ -z "$BASE_COSMOS_NAME" ]]; then
    BASE_COSMOS_NAME="vibecosmos"
fi

check_cosmos_name_available() {
    local name="$1"
    local name_available
    local exists
    local raw_bool

    # Newer shape: {"nameAvailable": true|false}
    name_available=$(az cosmosdb check-name-exists --name "$name" --query nameAvailable -o tsv 2>/dev/null || true)
    if [[ "$name_available" == "true" || "$name_available" == "false" ]]; then
        echo "$name_available"
        return 0
    fi

    # Alternate shape: {"exists": true|false}
    exists=$(az cosmosdb check-name-exists --name "$name" --query exists -o tsv 2>/dev/null || true)
    if [[ "$exists" == "true" ]]; then
        echo "false"
        return 0
    fi
    if [[ "$exists" == "false" ]]; then
        echo "true"
        return 0
    fi

    # Some CLI versions may return a raw boolean meaning "exists".
    raw_bool=$(az cosmosdb check-name-exists --name "$name" -o tsv 2>/dev/null || true)
    if [[ "$raw_bool" == "true" ]]; then
        echo "false"
        return 0
    fi
    if [[ "$raw_bool" == "false" ]]; then
        echo "true"
        return 0
    fi

    # Could not determine; treat as unavailable for safety.
    echo "false"
    return 1
}

NAME_AVAILABLE=$(check_cosmos_name_available "$BASE_COSMOS_NAME")
if [[ "$NAME_AVAILABLE" == "true" ]]; then
    COSMOS_ACCOUNT="$BASE_COSMOS_NAME"
else
    echo -e "${BLUE}Cosmos DB account name '${BASE_COSMOS_NAME}' is already taken globally.${NC}"
    FOUND_NAME=""

    for _ in {1..15}; do
        RANDOM_SUFFIX=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 6)
        CANDIDATE="${BASE_COSMOS_NAME}-${RANDOM_SUFFIX}"
        CANDIDATE=${CANDIDATE:0:44}
        CANDIDATE=$(echo "$CANDIDATE" | sed 's/-*$//')

        CANDIDATE_AVAILABLE=$(check_cosmos_name_available "$CANDIDATE")
        if [[ "$CANDIDATE_AVAILABLE" == "true" ]]; then
            FOUND_NAME="$CANDIDATE"
            break
        fi
    done

    if [[ -z "$FOUND_NAME" ]]; then
        echo -e "${RED}Error: Could not find an available Cosmos DB name automatically after multiple attempts.${NC}"
        echo -e "${RED}Please re-run and provide a longer unique base (example: vibe-cosmos-yourname-project-2026).${NC}"
        exit 1
    fi

    COSMOS_ACCOUNT="$FOUND_NAME"
    echo -e "${BLUE}Using available name: '${COSMOS_ACCOUNT}'${NC}"
fi

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
