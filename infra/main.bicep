@description('Short name prefix for all resources, e.g. "myapp"')
param appName string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Backend container image including registry, e.g. myacr.azurecr.io/backend:latest')
param backendImage string

@description('ACR login server, e.g. myacr.azurecr.io')
param acrLoginServer string

@description('ACR admin username')
param acrUsername string

@secure()
@description('ACR admin password')
param acrPassword string

@secure()
param postgresAdminPassword string

@secure()
param jwtSecretKey string

param azureOpenAiEndpoint string

@secure()
param azureOpenAiKey string

param azureOpenAiApiVersion string = '2024-02-15-preview'
param azureOpenAiEmbeddings string = 'text-embedding-3-small'
param azureOpenAiChat string = 'gpt-4o-mini'

@secure()
param azureStorageConnectionString string

param azureStorageContainer string = 'products'

@secure()
param azureSpeechKey string

param azureSpeechEndpoint string
param azureSpeechRegion string = 'centralus'

@description('Frontend URL for CORS (set after first deploy)')
param frontendUrl string = ''

@description('Region for PostgreSQL — must be quota-approved. Defaults to eastus2.')
param postgresLocation string = 'centralus'

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------
var pgServerName     = '${appName}-pgdb'
var pgAdminUser      = 'pgadmin'
var pgDbName         = 'appdb'
var logAnalyticsName = '${appName}-logs'
var envName          = '${appName}-env'
var apiAppName       = '${appName}-api'
var webAppName       = '${appName}-web'

// ---------------------------------------------------------------------------
// Log Analytics (required by Container Apps)
// ---------------------------------------------------------------------------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ---------------------------------------------------------------------------
// Container Apps Environment
// ---------------------------------------------------------------------------
resource containerEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL Flexible Server (Burstable B1ms — cheapest)
// ---------------------------------------------------------------------------
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: pgServerName
  location: postgresLocation
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: pgAdminUser
    administratorLoginPassword: postgresAdminPassword
    version: '16'
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
  }
}

resource pgVectorExtension 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-06-01-preview' = {
  parent: postgresServer
  name: 'azure.extensions'
  properties: {
    value: 'VECTOR'
    source: 'user-override'
  }
}

resource appDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: pgDbName
}

resource pgFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ---------------------------------------------------------------------------
// Backend — Container App
// ---------------------------------------------------------------------------
var dbUrl = 'postgresql+asyncpg://${pgAdminUser}:${postgresAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${pgDbName}'

resource apiApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: apiAppName
  location: location
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          username: acrUsername
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password',                    value: acrPassword }
        { name: 'jwt-secret-key',                  value: jwtSecretKey }
        { name: 'azure-openai-key',                value: azureOpenAiKey }
        { name: 'azure-storage-connection-string', value: azureStorageConnectionString }
        { name: 'azure-speech-key',                value: azureSpeechKey }
        { name: 'postgres-password',               value: postgresAdminPassword }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: backendImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'DATABASE_URL',                    value: dbUrl }
            { name: 'DATABASE_SSL',                    value: 'true' }
            { name: 'DEBUG',                           value: 'false' }
            { name: 'JWT_SECRET_KEY',                  secretRef: 'jwt-secret-key' }
            { name: 'AZURE_OPENAI_ENDPOINT',           value: azureOpenAiEndpoint }
            { name: 'AZURE_OPENAI_KEY',                secretRef: 'azure-openai-key' }
            { name: 'AZURE_OPENAI_API_VERSION',        value: azureOpenAiApiVersion }
            { name: 'AZURE_OPENAI_EMBEDDINGS',         value: azureOpenAiEmbeddings }
            { name: 'AZURE_OPENAI_CHAT',               value: azureOpenAiChat }
            { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: 'azure-storage-connection-string' }
            { name: 'AZURE_STORAGE_CONTAINER',         value: azureStorageContainer }
            { name: 'AZURE_SPEECH_KEY',                secretRef: 'azure-speech-key' }
            { name: 'AZURE_SPEECH_ENDPOINT',           value: azureSpeechEndpoint }
            { name: 'AZURE_SPEECH_REGION',             value: azureSpeechRegion }
            { name: 'CORS_ORIGINS',                    value: frontendUrl }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Frontend — Static Web App (Free tier)
// ---------------------------------------------------------------------------
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: webAppName
  location: 'eastus2'  // Static Web Apps only available in select regions
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
output backendUrl string = 'https://${apiApp.properties.configuration.ingress.fqdn}'
output frontendUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output staticWebAppName string = staticWebApp.name
output postgresHost string = postgresServer.properties.fullyQualifiedDomainName
