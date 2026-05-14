import type { Express } from "express";
import { storage } from "./storage";
import {
  insertDepartmentSchema,
  insertAdminUserSchema,
  insertResolverSchema,
  insertIssueAssignmentSchema,
} from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

function generateToken(userId: string): string {
  const payload = { userId, iat: Date.now() };
  const token = Buffer.from(JSON.stringify(payload)).toString("base64") + "." +
    crypto.randomBytes(32).toString("hex");
  return token;
}

export async function registerAdminRoutes(app: Express): Promise<void> {
  app.post("/api/admin/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      const adminUser = await storage.getAdminUserByUsername(username);
      if (!adminUser) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const isPasswordValid = await bcrypt.compare(password, adminUser.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      if (adminUser.status !== "active") {
        return res.status(403).json({ error: "Account is inactive" });
      }
      await storage.updateAdminUserLastActive(adminUser.id);
      const { password: _, ...safeUser } = adminUser;
      const token = generateToken(adminUser.id);
      res.json({ user: safeUser, token });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/admin/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/admin/departments", async (req, res) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  app.get("/api/admin/departments/:id", async (req, res) => {
    try {
      const department = await storage.getDepartment(req.params.id);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json(department);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch department" });
    }
  });

  app.post("/api/admin/departments", async (req, res) => {
    try {
      const parsed = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(parsed);
      res.status(201).json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.patch("/api/admin/departments/:id", async (req, res) => {
    try {
      const department = await storage.updateDepartment(req.params.id, req.body);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json(department);
    } catch (error) {
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  app.delete("/api/admin/departments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDepartment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      const adminUsers = await storage.getAdminUsers();
      const safeUsers = adminUsers.map(({ password, ...rest }) => rest);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin users" });
    }
  });

  app.get("/api/admin/users/:id", async (req, res) => {
    try {
      const adminUser = await storage.getAdminUser(req.params.id);
      if (!adminUser) {
        return res.status(404).json({ error: "Admin user not found" });
      }
      const { password, ...safeUser } = adminUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin user" });
    }
  });

  app.post("/api/admin/users", async (req, res) => {
    try {
      const parsed = insertAdminUserSchema.parse(req.body);
      const existing = await storage.getAdminUserByEmail(parsed.email);
      if (existing) {
        return res.status(400).json({ error: "Email already exists" });
      }
      const hashedPassword = await bcrypt.hash(parsed.password, SALT_ROUNDS);
      const adminUser = await storage.createAdminUser({
        ...parsed,
        password: hashedPassword,
      });
      const { password, ...safeUser } = adminUser;
      res.status(201).json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create admin user" });
    }
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    try {
      const updateData = { ...req.body };
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, SALT_ROUNDS);
      }
      const adminUser = await storage.updateAdminUser(req.params.id, updateData);
      if (!adminUser) {
        return res.status(404).json({ error: "Admin user not found" });
      }
      const { password, ...safeUser } = adminUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update admin user" });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAdminUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Admin user not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete admin user" });
    }
  });

  app.get("/api/admin/resolvers", async (req, res) => {
    try {
      const resolvers = await storage.getResolvers();
      res.json(resolvers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch resolvers" });
    }
  });

  app.get("/api/admin/resolvers/:id", async (req, res) => {
    try {
      const resolver = await storage.getResolver(req.params.id);
      if (!resolver) {
        return res.status(404).json({ error: "Resolver not found" });
      }
      res.json(resolver);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch resolver" });
    }
  });

  app.post("/api/admin/resolvers", async (req, res) => {
    try {
      const parsed = insertResolverSchema.parse(req.body);
      const resolver = await storage.createResolver(parsed);
      res.status(201).json(resolver);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create resolver" });
    }
  });

  app.patch("/api/admin/resolvers/:id", async (req, res) => {
    try {
      const resolver = await storage.updateResolver(req.params.id, req.body);
      if (!resolver) {
        return res.status(404).json({ error: "Resolver not found" });
      }
      res.json(resolver);
    } catch (error) {
      res.status(500).json({ error: "Failed to update resolver" });
    }
  });

  app.delete("/api/admin/resolvers/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteResolver(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Resolver not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete resolver" });
    }
  });

  app.get("/api/admin/issues", async (req, res) => {
    try {
      const { status, category, priority, limit } = req.query;
      const issues = await storage.getAdminIssues({
        status: status as string | undefined,
        category: category as string | undefined,
        priority: priority as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(issues);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch issues" });
    }
  });

  app.get("/api/admin/issues/:id", async (req, res) => {
    try {
      const issue = await storage.getIssue(req.params.id);
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      res.json(issue);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch issue" });
    }
  });

  app.patch("/api/admin/issues/:id/status", async (req, res) => {
    try {
      const { status, note } = req.body;
      const issue = await storage.getIssue(req.params.id);
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      const oldStatus = issue.status;
      const updatedIssue = await storage.updateIssueStatus(req.params.id, status);
      await storage.createStatusUpdate(req.params.id, oldStatus, status, note);
      res.json(updatedIssue);
    } catch (error) {
      res.status(500).json({ error: "Failed to update issue status" });
    }
  });

  app.post("/api/admin/issues/:id/assign", async (req, res) => {
    try {
      const { resolverId, assignedBy, notes } = req.body;

      // Validate required fields
      if (!resolverId || !assignedBy) {
        return res.status(400).json({ error: "resolverId and assignedBy are required" });
      }

      const issue = await storage.getIssue(req.params.id);
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }

      // Verify resolver exists
      const resolver = await storage.getResolver(resolverId);
      if (!resolver) {
        return res.status(404).json({ error: "Resolver not found" });
      }

      // Verify assignedBy admin exists
      const adminUser = await storage.getAdminUser(assignedBy);
      if (!adminUser) {
        return res.status(404).json({ error: "Admin user not found" });
      }

      const parsed = insertIssueAssignmentSchema.parse({
        issueId: req.params.id,
        resolverId,
        assignedBy,
        notes: notes || undefined,
      });

      const assignment = await storage.createIssueAssignment(parsed);
      await storage.updateIssueStatus(req.params.id, "assigned");
      await storage.createStatusUpdate(
        req.params.id,
        issue.status,
        "assigned",
        "Issue assigned to resolver"
      );
      await storage.incrementResolverLoad(parsed.resolverId);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Failed to assign issue:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to assign issue", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/admin/issues/:id/assignments", async (req, res) => {
    try {
      const assignments = await storage.getIssueAssignments(req.params.id);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });
}

const DEFAULT_DEPARTMENTS = [
  { name: "Road", slug: "road", description: "Road maintenance and repairs", icon: "road", color: "#EF4444", categories: ["pothole", "road_damage", "traffic_sign", "speed_breaker"] },
  { name: "Electrical", slug: "electrical", description: "Street lights and electrical infrastructure", icon: "zap", color: "#F59E0B", categories: ["street_light", "electrical_hazard", "power_outage"] },
  { name: "Water", slug: "water", description: "Water supply and pipeline issues", icon: "droplet", color: "#3B82F6", categories: ["water_leak", "water_supply", "pipeline", "water_quality"] },
  { name: "Drainage", slug: "drainage", description: "Drainage and sewage systems", icon: "waves", color: "#8B5CF6", categories: ["blocked_drain", "sewage", "flooding", "manhole"] },
  { name: "Sanitation", slug: "sanitation", description: "Waste management and cleanliness", icon: "trash-2", color: "#10B981", categories: ["garbage", "waste_dump", "cleanliness", "public_toilet"] },
  { name: "Public Safety", slug: "public_safety", description: "Public safety and security concerns", icon: "shield", color: "#6366F1", categories: ["unsafe_area", "missing_railing", "abandoned_vehicle", "stray_animals"] },
];

export async function initializeDefaultAdmin(): Promise<void> {
  const existingAdmin = await storage.getAdminUserByUsername("superadmin");
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("superadmin123", SALT_ROUNDS);
    await storage.createAdminUser({
      username: "superadmin",
      password: hashedPassword,
      name: "Super Admin",
      role: "super_admin",
      status: "active",
    });
    console.log("Default super admin created with username: superadmin, password: superadmin123");
  }

  const existingDepartments = await storage.getDepartments();
  if (existingDepartments.length === 0) {
    console.log("Seeding default departments with admins and resolvers...");

    for (const dept of DEFAULT_DEPARTMENTS) {
      const department = await storage.createDepartment({
        name: dept.name,
        slug: dept.slug,
        description: dept.description,
        icon: dept.icon,
        color: dept.color,
        categories: dept.categories,
        slaHours: 72,
        isActive: true,
      });

      const adminUsername = `admin_${dept.slug}`;
      const adminPassword = `${dept.slug}admin123`;
      const hashedAdminPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);

      const adminUser = await storage.createAdminUser({
        username: adminUsername,
        password: hashedAdminPassword,
        name: `${dept.name} Admin`,
        role: "admin",
        departmentId: department.id,
        status: "active",
      });
      console.log(`Created admin: ${adminUsername} / ${adminPassword}`);

      const resolverUsername = `resolver_${dept.slug}`;
      const resolverPassword = `${dept.slug}resolver123`;
      const hashedResolverPassword = await bcrypt.hash(resolverPassword, SALT_ROUNDS);

      const resolverAdminUser = await storage.createAdminUser({
        username: resolverUsername,
        password: hashedResolverPassword,
        name: `${dept.name} Resolver`,
        role: "resolver",
        departmentId: department.id,
        status: "active",
      });

      await storage.createResolver({
        adminUserId: resolverAdminUser.id,
        employeeId: `EMP-${dept.slug.toUpperCase()}-001`,
        specializations: dept.categories,
        jurisdictionAreas: ["Central", "North", "South", "East", "West"],
        currentLoad: 0,
        totalResolved: 0,
        status: "active",
      });
      console.log(`Created resolver: ${resolverUsername} / ${resolverPassword}`);
    }

    console.log("Default departments and users seeded successfully!");
  }
}
