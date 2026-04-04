/**
 * Migration script: SQLite to Cosmos DB
 * Usage: node scripts/migrate-to-cosmos.js
 */

const Database = require("better-sqlite3");
const path = require("path");
const {
  initializeCosmosDb,
  batchUpsert,
} = require("../src/config/cosmos-db");

async function migrateData() {
  console.log("🔄 Starting SQLite to Cosmos DB migration...\n");

  try {
    // Initialize Cosmos DB
    console.log("📡 Initializing Cosmos DB connection...");
    await initializeCosmosDb();
    console.log("✓ Connected to Cosmos DB\n");

    // Connect to SQLite
    const dbPath = path.join(__dirname, "../data/app.db");
    console.log(`📂 Opening SQLite database: ${dbPath}`);
    const db = new Database(dbPath);

    // Migrate Users
    console.log("👥 Migrating Users...");
    const users = db
      .prepare("SELECT * FROM users")
      .all()
      .map((user) => ({
        id: `user_${user.id}`,
        type: "user",
        userId: user.id,
        username: user.username,
        email: user.email,
        passwordHash: user.passwordHash,
        roleId: user.roleId,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
    await batchUpsert(users);
    console.log(`✓ Migrated ${users.length} users\n`);

    // Migrate Roles
    console.log("🔐 Migrating Roles...");
    const roles = db
      .prepare("SELECT * FROM roles")
      .all()
      .map((role) => ({
        id: `role_${role.id}`,
        type: "role",
        userId: role.userId || null,
        name: role.name,
        description: role.description,
        permissions: role.permissions ? JSON.parse(role.permissions) : [],
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      }));
    await batchUpsert(roles);
    console.log(`✓ Migrated ${roles.length} roles\n`);

    // Migrate Profile Fields
    console.log("📝 Migrating Profile Fields...");
    const profileFields = db
      .prepare("SELECT * FROM profile_fields")
      .all()
      .map((field) => ({
        id: `field_${field.id}`,
        type: "profile_field",
        userId: field.userId,
        fieldName: field.fieldName,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        order: field.order,
        createdAt: field.createdAt,
        updatedAt: field.updatedAt,
      }));
    await batchUpsert(profileFields);
    console.log(`✓ Migrated ${profileFields.length} profile fields\n`);

    // Migrate Social Platforms
    console.log("🌐 Migrating Social Platforms...");
    const socialPlatforms = db
      .prepare("SELECT * FROM social_platforms")
      .all()
      .map((platform) => ({
        id: `platform_${platform.id}`,
        type: "social_platform",
        userId: platform.userId,
        platformName: platform.platformName,
        apiKey: platform.apiKey,
        isActive: platform.isActive,
        createdAt: platform.createdAt,
        updatedAt: platform.updatedAt,
      }));
    await batchUpsert(socialPlatforms);
    console.log(`✓ Migrated ${socialPlatforms.length} social platforms\n`);

    // Migrate Connected Accounts
    console.log("🔗 Migrating Connected Accounts...");
    const connectedAccounts = db
      .prepare("SELECT * FROM connected_accounts")
      .all()
      .map((account) => ({
        id: `account_${account.id}`,
        type: "connected_account",
        userId: account.userId,
        accountType: account.accountType,
        externalUserId: account.externalUserId,
        email: account.email,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        tokenExpiresAt: account.tokenExpiresAt,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }));
    await batchUpsert(connectedAccounts);
    console.log(
      `✓ Migrated ${connectedAccounts.length} connected accounts\n`
    );

    // Migrate Settings
    console.log("⚙️  Migrating Settings...");
    const settings = db
      .prepare("SELECT * FROM settings")
      .all()
      .map((setting) => ({
        id: `setting_${setting.id}`,
        type: "setting",
        userId: setting.userId,
        key: setting.key,
        value: setting.value,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
      }));
    await batchUpsert(settings);
    console.log(`✓ Migrated ${settings.length} settings\n`);

    db.close();

    // Summary
    const totalMigrated =
      users.length +
      roles.length +
      profileFields.length +
      socialPlatforms.length +
      connectedAccounts.length +
      settings.length;
    console.log("✅ Migration completed successfully!");
    console.log(`📊 Total documents migrated: ${totalMigrated}`);
  } catch (error) {
    console.error("❌ Migration failed:");
    console.error(error.message);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrateData();
}

module.exports = { migrateData };
