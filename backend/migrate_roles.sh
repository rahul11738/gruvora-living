#!/bin/bash
# One-time MongoDB migration to normalize role values
# Run this script to fix all existing users with old role formats

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "Running MongoDB role migration..."
echo "Database: $DB_NAME"
echo ""

mongosh "$MONGO_URL" --eval '
const db = db.getSiblingDB("'"$DB_NAME"'");

print("Starting role migration...\n");

const roleMapping = {
    "Property Owner": "property_owner",
    "Stay Owner": "stay_owner",
    "Hotel Owner": "hotel_owner",
    "Service Provider": "service_provider",
    "Event Owner": "event_owner"
};

let totalUpdated = 0;

for (const [oldRole, newRole] of Object.entries(roleMapping)) {
    const result = db.users.updateMany(
        { role: oldRole },
        { $set: { role: newRole } }
    );
    print("  " + oldRole + " -> " + newRole + ": " + result.modifiedCount + " users updated");
    totalUpdated += result.modifiedCount;
}

print("\nMigration complete! Total users updated: " + totalUpdated);

print("\nVerification - role distribution after migration:");
db.users.aggregate([
    { $group: { _id: "$role", count: { $sum: 1 } } }
]).forEach(doc => {
    print("  " + doc._id + ": " + doc.count + " users");
});
'

echo ""
echo "Migration script completed."
