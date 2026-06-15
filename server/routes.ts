import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { insertUserSchema, insertIssueSchema, insertValidationSchema, insertCommentSchema, adminUsers, users } from "@shared/schema";
import { z } from "zod";
import { registerAdminRoutes, initializeDefaultAdmin } from "./admin-routes";
import { sendPushNotification } from "./push";
import bcrypt from "bcrypt";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Configurable validation threshold for auto-assignment
// Change this value to control how many "verified" votes trigger auto-assignment
const VALIDATION_THRESHOLD = 1;

export async function registerRoutes(app: Express): Promise<Server> {
  await registerAdminRoutes(app);
  await initializeDefaultAdmin();

  // Health check route for keeping Render awake
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

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

  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const { userId, role, currentPassword, newPassword } = req.body;
      if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (role === "resolver" || role === "admin") {
        const user = await storage.getAdminUser(userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) return res.status(400).json({ error: "Incorrect current password" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.update(adminUsers).set({ password: hashedPassword }).where(eq(adminUsers.id, userId));
      } else {
        const user = await storage.getUser(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) return res.status(400).json({ error: "Incorrect current password" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await storage.updateUser(userId, { password: hashedPassword });
      }

      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  app.post("/api/auth/delete-account", async (req, res) => {
    try {
      const { userId, role, password } = req.body;
      if (!userId || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (role === "resolver" || role === "admin") {
        const user = await storage.getAdminUser(userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(400).json({ error: "Incorrect password" });

        await db.update(adminUsers).set({ 
          status: "inactive",
          pushToken: null,
          email: null,
          phone: null
        }).where(eq(adminUsers.id, userId));
      } else {
        const user = await storage.getUser(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(400).json({ error: "Incorrect password" });

        await db.update(users).set({
          username: `deleted_${userId.substring(0,8)}`,
          password: await bcrypt.hash(Math.random().toString(), 10),
          displayName: "Deleted User",
          email: null,
          phone: null,
          pushToken: null,
          avatarUrl: null
        }).where(eq(users.id, userId));
      }

      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Failed to delete account" });
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

  app.put("/api/users/:id", async (req, res) => {
    try {
      const parsed = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(req.params.id, parsed);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update user" });
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

  app.get("/api/users/:userId/redemptions", async (req, res) => {
    try {
      const redemptions = await storage.getUserRedemptions(req.params.userId);
      res.json(redemptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch redemptions" });
    }
  });

  app.post("/api/users/:userId/redeem", async (req, res) => {
    try {
      const { amount } = req.body;
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.credits < amount) {
        return res.status(400).json({ error: "Insufficient credits" });
      }

      // Generate a random 8-character coupon code
      const couponCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      // Deduct credits
      await storage.updateUserCredits(user.id, -amount);

      // Create redemption record with expiration 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const redemption = await storage.createRedemption(user.id, amount, couponCode, expiresAt);

      res.status(201).json(redemption);
    } catch (error) {
      console.error("Redemption error:", error);
      res.status(500).json({ error: "Failed to process redemption" });
    }
  });

  app.get("/api/users/:userId/credit-allocations", async (req, res) => {
    try {
      const allocations = await storage.getUserCreditAllocations(req.params.userId);
      res.json(allocations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch credit allocations" });
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

  // Helper function to notify the citizen when their issue's status changes
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

      // Notify the reporter about the status update
      await storage.notifyUserOfStatusChange(issue, status);

      res.json(updatedIssue);
    } catch (error) {
      console.error("Status update error:", error);
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

      // Auto-assign when validation threshold is reached
      if (verified >= VALIDATION_THRESHOLD) {
        const issue = await storage.getIssue(parsed.issueId);
        if (issue && issue.status === "reported") {
          // Update to verified
          await storage.updateIssueStatus(parsed.issueId, "verified");
          await storage.createStatusUpdate(parsed.issueId, "reported", "verified", "Community verified with " + verified + " vote(s)");

          // Find nearest resolver
          const match = await storage.findNearestResolver(issue.category, issue.latitude, issue.longitude);
          if (match) {
            // Create assignment
            const assignment = await storage.createIssueAssignment({
              issueId: issue.id,
              resolverId: match.resolver.id,
              assignedBy: match.adminUser.id,
              notes: "Auto-assigned based on validation threshold and proximity",
            });

            // Update issue status to assigned
            await storage.updateIssueStatus(issue.id, "assigned");
            await storage.createStatusUpdate(issue.id, "verified", "assigned", `Auto-assigned to ${match.adminUser.name}`);
            await storage.incrementResolverLoad(match.resolver.id);


            // Send push notification to resolver
            if (match.adminUser.pushToken) {
              await sendPushNotification(
                match.adminUser.pushToken,
                "🚨 New Issue Assigned",
                `${issue.title} — ${issue.address || issue.district || "Unknown location"}`,
                { issueId: issue.id, assignmentId: assignment.id, type: "assignment", targetUserId: match.adminUser.id }
              );
            }

            // Notify citizen of assigned status
            await storage.notifyUserOfStatusChange(issue, "assigned");

            console.log(`Auto-assigned issue ${issue.id} to resolver ${match.adminUser.name}`);
          } else {
            // Only notify of verified status if not immediately assigned
            await storage.notifyUserOfStatusChange(issue, "verified");
            console.warn(`No matching resolver found for category: ${issue.category}`);
          }
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
        } catch (e) { }

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

  // Image analysis endpoint using Groq Vision API
  app.post("/api/analyze-image", async (req, res) => {
    try {
      const { image, language } = req.body;
      const targetLanguage = language || "English (US)";
      if (!image) {
        return res.status(400).json({ error: "No image data provided" });
      }

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        console.log("GROQ_API_KEY not set, skipping image analysis.");
        return res.json({
          title: "",
          description: "",
          category: "other",
          urgency: "Moderate",
        });
      }

      const Groq = (await import("groq-sdk")).default;
      const groq = new Groq({ apiKey });

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an assistant that helps format citizen reports. You MUST ALWAYS write descriptions in the FIRST PERSON, as if you are the person who took the photo reporting it to the city. Start with phrases like 'I am reporting...', 'There is an issue with...'. Do NOT describe the image itself (e.g. 'This image shows...'). Just report the problem. IMPORTANT: All responses (title, description) MUST be written in ${targetLanguage}.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Here is a photo of an issue. Provide a JSON response containing:\n- 'title': A short 3-5 word title.\n- 'description': A first-person report of the problem (e.g., 'I noticed a large pothole on my street today. It looks dangerous for cars...'). NEVER say 'The image shows'.\n- 'category': EXACTLY one of [roads, water, waste, electricity, drainage, sanitation, other].\n- 'urgency': EXACTLY one of [Low, Moderate, High, Critical].\n\nReturn ONLY raw JSON without any markdown formatting or extra text."
              },
              {
                type: "image_url",
                image_url: {
                  url: image.startsWith("data:image") ? image : `data:image/jpeg;base64,${image}`
                }
              }
            ]
          }
        ],
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0
      });

      let content = chatCompletion.choices[0]?.message?.content || "";
      // Strip markdown code blocks if the model wrapped the JSON
      content = content.replace(/```json/g, "").replace(/```/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse Groq response:", content);
        parsed = { title: "", description: "", category: "other", urgency: "Moderate" };
      }

      res.json({
        title: parsed.title || "",
        description: parsed.description || "",
        category: parsed.category || "other",
        urgency: parsed.urgency || "Moderate"
      });
    } catch (error) {
      console.error("Analyze image error:", error);
      res.status(500).json({ error: "Image analysis failed" });
    }
  });

  // ── Push Token Registration ──
  app.post("/api/resolver/push-token", async (req, res) => {
    try {
      const { adminUserId, pushToken } = req.body;
      if (!adminUserId || !pushToken) {
        return res.status(400).json({ error: "adminUserId and pushToken are required" });
      }
      await storage.updateAdminUserPushToken(adminUserId, pushToken);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to save resolver push token:", error);
      res.status(500).json({ error: "Failed to save push token" });
    }
  });

  app.post("/api/users/push-token", async (req, res) => {
    try {
      const { userId, pushToken } = req.body;
      if (!userId || !pushToken) {
        return res.status(400).json({ error: "userId and pushToken are required" });
      }
      await storage.updateUserPushToken(userId, pushToken);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to save user push token:", error);
      res.status(500).json({ error: "Failed to save push token" });
    }
  });


  // Admin App Users endpoints
  app.get("/api/admin/app-users", async (req, res) => {
    try {
      const users = await storage.getLeaderboard(1000); // Fetch all normal users
      const safeUsers = users.map(({ password, ...rest }) => rest);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch app users" });
    }
  });

  app.post("/api/admin/users/:userId/credits", async (req, res) => {
    try {
      const { amount } = req.body;
      if (!amount || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      const updatedUser = await storage.updateUserCredits(req.params.userId, amount, "Added by Admin");
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "Credits added successfully", credits: updatedUser.credits });
    } catch (error) {
      res.status(500).json({ error: "Failed to add credits" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
