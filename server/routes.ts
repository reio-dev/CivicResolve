import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { insertUserSchema, insertIssueSchema, insertValidationSchema, insertCommentSchema } from "@shared/schema";
import { z } from "zod";
import { registerAdminRoutes, initializeDefaultAdmin } from "./admin-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  await registerAdminRoutes(app);
  await initializeDefaultAdmin();
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = insertUserSchema.parse(req.body);
      const existing = await storage.getUserByUsername(parsed.username);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }
      const user = await storage.createUser(parsed);
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const { password: _, ...safeUser } = user;
      res.json({ ...safeUser, role: "user" });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/resolver/login", async (req, res) => {
    try {
      const bcrypt = await import("bcrypt");
      const { username, password } = req.body;
      const adminUser = await storage.getAdminUserByUsername(username);
      if (!adminUser) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const isPasswordValid = await bcrypt.compare(password, adminUser.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      if (adminUser.role !== "resolver") {
        return res.status(403).json({ error: "Only resolvers can login through this endpoint" });
      }
      if (adminUser.status !== "active") {
        return res.status(403).json({ error: "Account is inactive" });
      }
      const resolver = await storage.getResolverByAdminUserId(adminUser.id);
      const { password: _, ...safeUser } = adminUser;
      res.json({
        ...safeUser,
        role: "resolver",
        resolverId: resolver?.id || null,
        specializations: resolver?.specializations || [],
        totalResolved: resolver?.totalResolved || 0,
        currentLoad: resolver?.currentLoad || 0,
        rating: resolver?.rating || 0,
      });
    } catch (error) {
      console.error("Resolver login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/resolver/:resolverId/assignments", async (req, res) => {
    try {
      const assignments = await storage.getResolverAssignments(req.params.resolverId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });

  app.patch("/api/resolver/assignments/:assignmentId/resolve", async (req, res) => {
    try {
      const { resolutionImages, notes } = req.body;
      const assignment = await storage.updateAssignmentStatus(
        req.params.assignmentId,
        "completed",
        resolutionImages,
        notes
      );
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      const issue = await storage.getIssue(assignment.issueId);
      if (issue) {
        await storage.updateIssueStatus(issue.id, "resolved");
        await storage.createStatusUpdate(issue.id, issue.status, "resolved", "Issue resolved by field worker");
        await storage.incrementResolverResolved(assignment.resolverId);
      }
      res.json(assignment);
    } catch (error) {
      console.error("Resolve assignment error:", error);
      res.status(500).json({ error: "Failed to resolve assignment" });
    }
  });

  // NEW: Dashboard Data
  app.get("/api/resolver/dashboard/:adminUserId", async (req, res) => {
    try {
      const data = await storage.getResolverDashboardData(req.params.adminUserId);
      res.json(data);
    } catch (error: any) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch dashboard data" });
    }
  });

  app.get("/api/resolver-leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const resolvers = await storage.getResolverLeaderboard(limit);
      res.json(resolvers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch resolver leaderboard" });
    }
  });

  // User routes
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const users = await storage.getLeaderboard(limit);
      const safeUsers = users.map(({ password, ...rest }) => rest);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Issue routes
  app.get("/api/issues", async (req, res) => {
    try {
      const { status, userId, lat, lng, radius, district } = req.query;
      
      let issues;
      if (district) {
        issues = await storage.getIssuesByDistrict(district as string);
      } else if (lat && lng) {
        issues = await storage.getNearbyIssues(
          parseFloat(lat as string),
          parseFloat(lng as string),
          radius ? parseFloat(radius as string) : 10
        );
      } else if (status) {
        issues = await storage.getIssuesByStatus(status as string);
      } else if (userId) {
        issues = await storage.getIssuesByUser(userId as string);
      } else {
        issues = await storage.getIssues();
      }
      res.json(issues);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch issues" });
    }
  });

  app.get("/api/issues/:id", async (req, res) => {
    try {
      const issue = await storage.getIssue(req.params.id);
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      const assignments = await storage.getIssueAssignments(req.params.id);
      const completedAssignment = assignments.find(a => a.status === "completed");
      const resolutionPhotos = completedAssignment?.resolutionImages || [];
      const resolvedAt = completedAssignment?.completedAt || null;

      // Fetch reporter info
      const reporter = await storage.getUser(issue.reporterId);
      const reporterName = reporter?.displayName || reporter?.username || "Anonymous";

      res.json({ ...issue, resolutionPhotos, resolvedAt, reporterName });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch issue" });
    }
  });

  app.post("/api/issues", async (req, res) => {
    try {
      const parsed = insertIssueSchema.parse(req.body);
      const issue = await storage.createIssue(parsed);
      await storage.incrementUserStat(parsed.reporterId, "issuesReported");
      await storage.updateUserPoints(parsed.reporterId, 25);
      res.status(201).json(issue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create issue" });
    }
  });

  app.patch("/api/issues/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const issue = await storage.getIssue(req.params.id);
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      
      const oldStatus = issue.status;
      const updatedIssue = await storage.updateIssueStatus(req.params.id, status);
      await storage.createStatusUpdate(req.params.id, oldStatus, status);
      
      if (status === "resolved") {
        await storage.incrementUserStat(issue.reporterId, "issuesResolved");
        await storage.updateUserPoints(issue.reporterId, 50);
      }
      
      res.json(updatedIssue);
    } catch (error) {
      res.status(500).json({ error: "Failed to update issue status" });
    }
  });

  app.get("/api/issues/:id/status-updates", async (req, res) => {
    try {
      const updates = await storage.getStatusUpdatesByIssue(req.params.id);
      res.json(updates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch status updates" });
    }
  });

  // Validation routes
  app.get("/api/issues/:issueId/validations", async (req, res) => {
    try {
      const validations = await storage.getValidationsByIssue(req.params.issueId);
      res.json(validations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch validations" });
    }
  });

  app.get("/api/users/:userId/validations", async (req, res) => {
    try {
      const validations = await storage.getUserValidations(req.params.userId);
      res.json(validations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user validations" });
    }
  });

  app.post("/api/issues/:issueId/validations", async (req, res) => {
    try {
      const parsed = insertValidationSchema.parse({
        ...req.body,
        issueId: req.params.issueId,
      });
      
      const existing = await storage.getUserValidation(parsed.userId, parsed.issueId);
      if (existing) {
        return res.status(400).json({ error: "You have already validated this issue" });
      }
      
      const validation = await storage.createValidation(parsed);
      await storage.incrementUserStat(parsed.userId, "validationsGiven");
      await storage.updateUserPoints(parsed.userId, 10);
      
      const allValidations = await storage.getValidationsByIssue(parsed.issueId);
      const verified = allValidations.filter(v => v.vote === "verified").length;
      const invalid = allValidations.filter(v => v.vote === "invalid").length;
      const unclear = allValidations.filter(v => v.vote === "unclear").length;
      await storage.updateIssueValidationCounts(parsed.issueId, verified, invalid, unclear);
      
      if (verified >= 3) {
        const issue = await storage.getIssue(parsed.issueId);
        if (issue && issue.status === "reported") {
          await storage.updateIssueStatus(parsed.issueId, "verified");
          await storage.createStatusUpdate(parsed.issueId, "reported", "verified", "Community verified with " + verified + " votes");
        }
      }
      
      res.status(201).json(validation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create validation" });
    }
  });

  // Comment routes
  app.get("/api/issues/:issueId/comments", async (req, res) => {
    try {
      const comments = await storage.getCommentsByIssue(req.params.issueId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/issues/:issueId/comments", async (req, res) => {
    try {
      const parsed = insertCommentSchema.parse({
        ...req.body,
        issueId: req.params.issueId,
      });
      const comment = await storage.createComment(parsed);
      await storage.updateUserPoints(parsed.userId, 5);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // Status updates
  app.get("/api/issues/:issueId/status-updates", async (req, res) => {
    try {
      const updates = await storage.getStatusUpdatesByIssue(req.params.issueId);
      res.json(updates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch status updates" });
    }
  });

  // Badges
  app.get("/api/badges", async (req, res) => {
    try {
      const allBadges = await storage.getBadges();
      res.json(allBadges);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch badges" });
    }
  });

  app.get("/api/users/:userId/badges", async (req, res) => {
    try {
      const userBadges = await storage.getUserBadges(req.params.userId);
      res.json(userBadges);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user badges" });
    }
  });

  // Audio transcription endpoint using Sarvam AI
  app.post("/api/transcribe", async (req, res) => {
    try {
      const { audio, mimeType } = req.body;
      if (!audio) {
        return res.status(400).json({ error: "No audio data provided" });
      }

      const apiKey = process.env.SARVAM_AI_API_KEY;
      if (!apiKey) {
        console.log("SARVAM_AI_API_KEY not set, returning empty transcript.");
        return res.json({
          transcript: "",
          message: "Speech-to-text API key not configured.",
        });
      }

      try {
        const { SarvamAIClient } = await import("sarvamai");
        const client = new SarvamAIClient({
          apiSubscriptionKey: apiKey,
        });

        const fs = require("fs");
        const os = require("os");
        const path = require("path");
        
        // Write base64 audio to a temporary file
        const buffer = Buffer.from(audio, "base64");
        const tempFilePath = path.join(os.tmpdir(), `recording_${Date.now()}.m4a`);
        fs.writeFileSync(tempFilePath, buffer);

        const job = await client.speechToTextJob.createJob({
            model: "saaras:v3",
            languageCode: "unknown",
            withDiarization: false,
            numSpeakers: 1
        });

        // Upload and process files
        const audioPaths = [tempFilePath];
        await job.uploadFiles(audioPaths);
        await job.start();

        // Wait for completion
        await job.waitUntilComplete();

        // Check file-level results
        const fileResults = await job.getFileResults();

        let transcript = "";
        if (fileResults.successful.length > 0) {
            const outputDir = path.join(os.tmpdir(), `out_${Date.now()}`);
            fs.mkdirSync(outputDir, { recursive: true });
            await job.downloadOutputs(outputDir);

            // Read the downloaded outputs
            const files = fs.readdirSync(outputDir);
            for (const filename of files) {
              if (filename.endsWith(".txt")) {
                transcript += fs.readFileSync(path.join(outputDir, filename), "utf8");
              } else if (filename.endsWith(".json")) {
                const jsonObj = JSON.parse(fs.readFileSync(path.join(outputDir, filename), "utf8"));
                transcript += jsonObj.transcript || jsonObj.text || "";
              }
            }
        } else if (fileResults.failed.length > 0) {
            console.error("Transcription failed for file:", fileResults.failed[0].error_message);
        }

        // Clean up temporary file
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {}

        return res.json({ transcript: transcript.trim() });
      } catch (aiError: any) {
        console.error("Sarvam AI transcription error:", aiError?.message || aiError);
        return res.json({
          transcript: "",
          message: "Transcription service error. Please type your description manually.",
        });
      }
    } catch (error) {
      console.error("Transcribe error:", error);
      res.status(500).json({ error: "Transcription failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
