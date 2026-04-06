const { CosmosClient } = require("@azure/cosmos");

let client = null;
let database = null;
let container = null;

/**
 * Initialize Cosmos DB connection
 */
async function initializeCosmosDb() {
  if (client) {
    return { database, container };
  }

  const endpoint = process.env.COSMOS_DB_ENDPOINT;
  const key = process.env.COSMOS_DB_KEY;
  const databaseId = process.env.COSMOS_DB_DATABASE || "vibe_coding";
  const containerId = "items";

  if (!endpoint || !key) {
    throw new Error(
      "Cosmos DB configuration missing. Set COSMOS_DB_ENDPOINT and COSMOS_DB_KEY"
    );
  }

  client = new CosmosClient({ endpoint, key });

  // Create database if it doesn't exist
  const { database: db } = await client.databases.createIfNotExists({
    id: databaseId,
  });
  database = db;

  // Create container if it doesn't exist
  const { container: cont } = await database.containers.createIfNotExists({
    id: containerId,
    partitionKey: { paths: ["/userId"] },
    throughput: 400,
  });
  container = cont;

  console.log(`✓ Connected to Cosmos DB: ${databaseId}/${containerId}`);

  return { database, container };
}

/**
 * Get a document by ID
 */
async function getDocument(id, userId) {
  const { item } = await container.item(id, userId).read();
  return item;
}

/**
 * Query documents
 */
async function queryDocuments(query, parameters = []) {
  const { resources } = await container.items
    .query({
      query,
      parameters,
    })
    .fetchAll();
  return resources;
}

/**
 * Create a document
 */
async function createDocument(document) {
  const { resource } = await container.items.create(document);
  return resource;
}

/**
 * Update a document
 */
async function updateDocument(id, userId, updates) {
  const { item } = await container.item(id, userId).read();
  const updated = { ...item, ...updates };
  const { resource } = await container.item(id, userId).replace(updated);
  return resource;
}

/**
 * Delete a document
 */
async function deleteDocument(id, userId) {
  await container.item(id, userId).delete();
}

/**
 * Batch upsert documents
 */
async function batchUpsert(documents) {
  const results = [];
  for (const doc of documents) {
    const { resource } = await container.items.upsert(doc);
    results.push(resource);
  }
  return results;
}

module.exports = {
  initializeCosmosDb,
  getDocument,
  queryDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  batchUpsert,
};
