# =============================================================================
# deploy.ps1  —  Full deployment to Azure
# Run from the repo root: .\infra\deploy.ps1
# =============================================================================

# ---------------------------------------------------------------------------
# CONFIG — change these
# ---------------------------------------------------------------------------
$APP_NAME       = "etoddlershop"                  # prefix for all Azure resource names
$RESOURCE_GROUP = "$APP_NAME-rg"
$LOCATION       = "eastus"
$ACR_NAME       = "${APP_NAME}acr"         # must be globally unique, lowercase, no dashes
$IMAGE_TAG      = "latest"

# ---------------------------------------------------------------------------
# Load secrets from backend/.env
# ---------------------------------------------------------------------------
Write-Host "`n[1/8] Loading secrets from backend/.env..." -ForegroundColor Cyan

$envFile = Join-Path $PSScriptRoot "..\backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Error "backend/.env not found. Copy .env.example and fill in your keys."
    exit 1
}

$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+?)\s*=\s*(.+)\s*$") {
        $envVars[$matches[1]] = $matches[2]
    }
}

$AZURE_OPENAI_ENDPOINT           = $envVars["AZURE_OPENAI_ENDPOINT"]
$AZURE_OPENAI_KEY                = $envVars["AZURE_OPENAI_KEY"]
$AZURE_OPENAI_API_VERSION        = $envVars["AZURE_OPENAI_API_VERSION"]
$AZURE_OPENAI_EMBEDDINGS         = $envVars["AZURE_OPENAI_EMBEDDINGS"]
$AZURE_OPENAI_CHAT               = $envVars["AZURE_OPENAI_CHAT"]
$AZURE_STORAGE_CONNECTION_STRING = $envVars["AZURE_STORAGE_CONNECTION_STRING"]
$AZURE_STORAGE_CONTAINER         = $envVars["AZURE_STORAGE_CONTAINER"]
$AZURE_SPEECH_KEY                = $envVars["AZURE_SPEECH_KEY"]
$AZURE_SPEECH_ENDPOINT           = $envVars["AZURE_SPEECH_ENDPOINT"]
$AZURE_SPEECH_REGION             = $envVars["AZURE_SPEECH_REGION"]

# Prompt for secrets not in .env
$POSTGRES_PASSWORD = Read-Host "Enter a strong PostgreSQL admin password" -AsSecureString
$POSTGRES_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($POSTGRES_PASSWORD))

$JWT_SECRET = Read-Host "Enter a JWT secret key (long random string)" -AsSecureString
$JWT_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($JWT_SECRET))

# ---------------------------------------------------------------------------
# Login check
# ---------------------------------------------------------------------------
Write-Host "`n[2/8] Checking Azure login..." -ForegroundColor Cyan
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Not logged in. Running az login..."
    az login
}
Write-Host "Logged in as: $($account.user.name) | Subscription: $($account.name)"

# ---------------------------------------------------------------------------
# Resource group
# ---------------------------------------------------------------------------
Write-Host "`n[3/8] Creating resource group '$RESOURCE_GROUP'..." -ForegroundColor Cyan
az group create --name $RESOURCE_GROUP --location $LOCATION | Out-Null

# ---------------------------------------------------------------------------
# Azure Container Registry
# ---------------------------------------------------------------------------
Write-Host "`n[4/8] Creating Container Registry '$ACR_NAME' and building image..." -ForegroundColor Cyan
az acr create --name $ACR_NAME --resource-group $RESOURCE_GROUP --sku Basic --admin-enabled true | Out-Null

Write-Host "Building and pushing backend image (this takes ~3 min)..."
$backendPath = Join-Path $PSScriptRoot "..\backend"
az acr build --registry $ACR_NAME --image "backend:$IMAGE_TAG" $backendPath

$ACR_LOGIN_SERVER = az acr show --name $ACR_NAME --query loginServer -o tsv
$ACR_USERNAME     = az acr credential show --name $ACR_NAME --query username -o tsv
$ACR_PASSWORD     = az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv
$BACKEND_IMAGE    = "$ACR_LOGIN_SERVER/backend:$IMAGE_TAG"

# ---------------------------------------------------------------------------
# Deploy Bicep (first pass — no frontend URL yet)
# ---------------------------------------------------------------------------
Write-Host "`n[5/8] Deploying Azure infrastructure via Bicep..." -ForegroundColor Cyan
$bicepFile = Join-Path $PSScriptRoot "main.bicep"

$deployOutput = az deployment group create `
    --resource-group $RESOURCE_GROUP `
    --template-file $bicepFile `
    --parameters `
        appName=$APP_NAME `
        location=$LOCATION `
        postgresLocation=centralus `
        backendImage=$BACKEND_IMAGE `
        acrLoginServer=$ACR_LOGIN_SERVER `
        acrUsername=$ACR_USERNAME `
        acrPassword=$ACR_PASSWORD `
        postgresAdminPassword=$POSTGRES_PASSWORD `
        jwtSecretKey=$JWT_SECRET `
        azureOpenAiEndpoint=$AZURE_OPENAI_ENDPOINT `
        azureOpenAiKey=$AZURE_OPENAI_KEY `
        azureOpenAiApiVersion=$AZURE_OPENAI_API_VERSION `
        azureOpenAiEmbeddings=$AZURE_OPENAI_EMBEDDINGS `
        azureOpenAiChat=$AZURE_OPENAI_CHAT `
        azureStorageConnectionString=$AZURE_STORAGE_CONNECTION_STRING `
        azureStorageContainer=$AZURE_STORAGE_CONTAINER `
        azureSpeechKey=$AZURE_SPEECH_KEY `
        azureSpeechEndpoint=$AZURE_SPEECH_ENDPOINT `
        azureSpeechRegion=$AZURE_SPEECH_REGION `
    --query properties.outputs `
    -o json | ConvertFrom-Json

$BACKEND_URL      = $deployOutput.backendUrl.value
$FRONTEND_URL     = $deployOutput.frontendUrl.value
$SWA_NAME         = $deployOutput.staticWebAppName.value

Write-Host "Backend URL : $BACKEND_URL"
Write-Host "Frontend URL: $FRONTEND_URL"

# ---------------------------------------------------------------------------
# Build and deploy frontend
# ---------------------------------------------------------------------------
Write-Host "`n[6/8] Building React frontend with API URL..." -ForegroundColor Cyan
$clientPath = Join-Path $PSScriptRoot "..\client"
Push-Location $clientPath
$env:VITE_API_URL = $BACKEND_URL
npm ci
npm run build
Pop-Location

Write-Host "`n[7/8] Deploying frontend to Static Web Apps..." -ForegroundColor Cyan
$SWA_TOKEN = az staticwebapp secrets list --name $SWA_NAME --resource-group $RESOURCE_GROUP `
    --query "properties.apiKey" -o tsv

$distPath = Join-Path $PSScriptRoot "..\client\dist"

# Install SWA CLI globally and invoke via full path (avoids PATH refresh issue on Windows)
npm install -g @azure/static-web-apps-cli 2>$null
$swaBin = "$env:APPDATA\npm\swa.cmd"
& $swaBin deploy $distPath `
    --deployment-token $SWA_TOKEN `
    --env production

# ---------------------------------------------------------------------------
# Update backend CORS with frontend URL (second Bicep pass)
# ---------------------------------------------------------------------------
Write-Host "`n[8/8] Updating backend CORS to allow frontend URL..." -ForegroundColor Cyan
az deployment group create `
    --resource-group $RESOURCE_GROUP `
    --template-file $bicepFile `
    --parameters `
        appName=$APP_NAME `
        location=$LOCATION `
        postgresLocation=centralus `
        backendImage=$BACKEND_IMAGE `
        acrLoginServer=$ACR_LOGIN_SERVER `
        acrUsername=$ACR_USERNAME `
        acrPassword=$ACR_PASSWORD `
        postgresAdminPassword=$POSTGRES_PASSWORD `
        jwtSecretKey=$JWT_SECRET `
        azureOpenAiEndpoint=$AZURE_OPENAI_ENDPOINT `
        azureOpenAiKey=$AZURE_OPENAI_KEY `
        azureOpenAiApiVersion=$AZURE_OPENAI_API_VERSION `
        azureOpenAiEmbeddings=$AZURE_OPENAI_EMBEDDINGS `
        azureOpenAiChat=$AZURE_OPENAI_CHAT `
        azureStorageConnectionString=$AZURE_STORAGE_CONNECTION_STRING `
        azureStorageContainer=$AZURE_STORAGE_CONTAINER `
        azureSpeechKey=$AZURE_SPEECH_KEY `
        azureSpeechEndpoint=$AZURE_SPEECH_ENDPOINT `
        azureSpeechRegion=$AZURE_SPEECH_REGION `
        frontendUrl=$FRONTEND_URL `
    | Out-Null

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
Write-Host "`n=====================================================" -ForegroundColor Green
Write-Host " Deployment complete!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Frontend : $FRONTEND_URL"
Write-Host " Backend  : $BACKEND_URL"
Write-Host " API Docs : $BACKEND_URL/docs"
Write-Host ""
Write-Host " Next step: index your products for AI search" -ForegroundColor Yellow
Write-Host " POST $BACKEND_URL/api/v1/ai/embed-products" -ForegroundColor Yellow
Write-Host " (log in as admin/admin first to get a JWT token)" -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Green
