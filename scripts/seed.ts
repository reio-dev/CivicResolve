import "dotenv/config";
import { initializeDefaultAdmin } from "../server/admin-routes";

console.log("Seeding database...");
initializeDefaultAdmin()
  .then(() => {
    console.log("Database seeded successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error seeding database:", err);
    process.exit(1);
  });
