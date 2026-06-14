import {
  users,
  issues,
  validations,
  comments,
  statusUpdates,
  badges,
  userBadges,
  departments,
  adminUsers,
  resolvers,
  issueAssignments,
  type User,
  type InsertUser,
  type Issue,
  type InsertIssue,
  type Validation,
  type InsertValidation,
  type Comment,
  type InsertComment,
  type StatusUpdate,
  type Badge,
  type UserBadge,
  type Department,
  type InsertDepartment,
  type AdminUser,
  type InsertAdminUser,
  type Resolver,
  type InsertResolver,
  type IssueAssignment,
  type InsertIssueAssignment,
  redemptions,
  type Redemption,
  type InsertRedemption,
  creditAllocations,
  type CreditAllocation,
  type InsertCreditAllocation,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, count } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPoints(userId: string, points: number): Promise<User | undefined>;
  updateUserCredits(userId: string, credits: number): Promise<User | undefined>;
  incrementUserStat(
    userId: string,
    stat: "issuesReported" | "issuesResolved" | "validationsGiven",
  ): Promise<void>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getLeaderboard(limit?: number): Promise<User[]>;

  getUserRedemptions(userId: string): Promise<Redemption[]>;
  createRedemption(userId: string, amount: number, couponCode: string, expiresAt: Date): Promise<Redemption>;

  getUserCreditAllocations(userId: string): Promise<CreditAllocation[]>;
  createCreditAllocation(userId: string, amount: number, reason: string): Promise<CreditAllocation>;

  getIssue(id: string): Promise<Issue | undefined>;
  getIssues(limit?: number): Promise<Issue[]>;
  getIssuesByUser(userId: string): Promise<Issue[]>;
  getIssuesByStatus(status: string): Promise<Issue[]>;
  getNearbyIssues(
    lat: number,
    lng: number,
    radiusKm?: number,
  ): Promise<Issue[]>;
  getIssuesByDistrict(district: string): Promise<Issue[]>;
  createIssue(issue: InsertIssue): Promise<Issue>;
  updateIssueStatus(id: string, status: string): Promise<Issue | undefined>;
  updateIssueValidationCounts(
    id: string,
    verified: number,
    invalid: number,
    unclear: number,
  ): Promise<void>;

  getValidationsByIssue(issueId: string): Promise<Validation[]>;
  getUserValidation(
    userId: string,
    issueId: string,
  ): Promise<Validation | undefined>;
  getUserValidations(userId: string): Promise<Validation[]>;
  createValidation(validation: InsertValidation): Promise<Validation>;

  getCommentsByIssue(issueId: string): Promise<(Comment & { userName: string | null })[]>;
  createComment(comment: InsertComment): Promise<Comment>;

  getStatusUpdatesByIssue(issueId: string): Promise<StatusUpdate[]>;
  createStatusUpdate(
    issueId: string,
    fromStatus: string,
    toStatus: string,
    note?: string,
  ): Promise<StatusUpdate>;

  getBadges(): Promise<Badge[]>;
  getUserBadges(userId: string): Promise<UserBadge[]>;
  awardBadge(userId: string, badgeId: string): Promise<UserBadge>;
  getResolverDashboardData(adminUserId: string): Promise<any>;

  updateAdminUserPushToken(id: string, pushToken: string): Promise<void>;
  updateUserPushToken(id: string, pushToken: string): Promise<void>;
  findNearestResolver(issueCategory: string, issueLat: number, issueLng: number): Promise<{ resolver: Resolver; adminUser: AdminUser } | null>;
  
  // High-level Notification Helpers (Push only)
  notifyUserOfStatusChange(issue: any, newStatus: string): Promise<void>;
  notifyUserOfCredits(userId: string, amount: number, reason: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserPoints(
    userId: string,
    points: number,
    reason?: string
  ): Promise<User | undefined> {
    const userToUpdate = await this.getUser(userId);
    if (!userToUpdate) return undefined;

    const newPoints = userToUpdate.points + points;
    const newLevel = Math.floor(newPoints / 1000) + 1;
    
    const updateData: any = { 
      points: newPoints,
      level: newLevel,
    };
    if (points > 0) {
      updateData.credits = sql`${users.credits} + ${points}`;
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    if (updatedUser && points > 0) {
      await this.createCreditAllocation(userId, points, reason || "Points Earned");
      await this.notifyUserOfCredits(userId, points, reason || "Reward for participation");
    }

    return updatedUser || undefined;
  }

  async updateUserCredits(
    userId: string,
    credits: number,
    reason?: string
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ credits: sql`${users.credits} + ${credits}` })
      .where(eq(users.id, userId))
      .returning();

    if (user && credits > 0) {
      await this.createCreditAllocation(userId, credits, reason || "Credits Added");
    }

    return user || undefined;
  }

  async incrementUserStat(
    userId: string,
    stat: "issuesReported" | "issuesResolved" | "validationsGiven",
  ): Promise<void> {
    await db
      .update(users)
      .set({ [stat]: sql`${users[stat]} + 1` })
      .where(eq(users.id, userId));
  }

  async getLeaderboard(limit = 10): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.points)).limit(limit);
  }

  async getUserRedemptions(userId: string): Promise<Redemption[]> {
    return db
      .select()
      .from(redemptions)
      .where(eq(redemptions.userId, userId))
      .orderBy(desc(redemptions.createdAt));
  }

  async createRedemption(userId: string, amount: number, couponCode: string, expiresAt: Date): Promise<Redemption> {
    const [redemption] = await db
      .insert(redemptions)
      .values({ userId, amount, couponCode, expiresAt })
      .returning();
    return redemption;
  }

  async getUserCreditAllocations(userId: string): Promise<CreditAllocation[]> {
    return db
      .select()
      .from(creditAllocations)
      .where(eq(creditAllocations.userId, userId))
      .orderBy(desc(creditAllocations.createdAt));
  }

  async createCreditAllocation(userId: string, amount: number, reason: string): Promise<CreditAllocation> {
    const [allocation] = await db
      .insert(creditAllocations)
      .values({ userId, amount, reason })
      .returning();
    return allocation;
  }

  async getIssue(id: string): Promise<Issue | undefined> {
    const [issue] = await db.select().from(issues).where(eq(issues.id, id));
    return issue || undefined;
  }

  async getIssues(limit = 50): Promise<Issue[]> {
    return db
      .select()
      .from(issues)
      .orderBy(desc(issues.createdAt))
      .limit(limit);
  }

  async getIssuesByUser(userId: string): Promise<Issue[]> {
    return db
      .select()
      .from(issues)
      .where(eq(issues.reporterId, userId))
      .orderBy(desc(issues.createdAt));
  }

  async getIssuesByStatus(status: string): Promise<Issue[]> {
    return db
      .select()
      .from(issues)
      .where(eq(issues.status, status))
      .orderBy(desc(issues.createdAt));
  }

  async getNearbyIssues(
    lat: number,
    lng: number,
    radiusKm = 10,
  ): Promise<Issue[]> {
    const radiusDeg = radiusKm / 111;
    return db
      .select()
      .from(issues)
      .where(
        and(
          sql`${issues.latitude} BETWEEN ${lat - radiusDeg} AND ${lat + radiusDeg}`,
          sql`${issues.longitude} BETWEEN ${lng - radiusDeg} AND ${lng + radiusDeg}`,
        ),
      )
      .orderBy(desc(issues.createdAt));
  }

  async getIssuesByDistrict(district: string): Promise<Issue[]> {
    return db
      .select()
      .from(issues)
      .where(eq(issues.district, district))
      .orderBy(desc(issues.createdAt));
  }

  async createIssue(issue: InsertIssue): Promise<Issue> {
    const [newIssue] = await db.insert(issues).values(issue).returning();
    return newIssue;
  }

  async updateIssueStatus(
    id: string,
    status: string,
  ): Promise<Issue | undefined> {
    const resolvedAt = status === "resolved" ? new Date() : null;
    const [issue] = await db
      .update(issues)
      .set({ status, resolvedAt, updatedAt: new Date() })
      .where(eq(issues.id, id))
      .returning();
    return issue || undefined;
  }

  async updateIssueValidationCounts(
    id: string,
    verified: number,
    invalid: number,
    unclear: number,
  ): Promise<void> {
    await db
      .update(issues)
      .set({
        verifiedCount: verified,
        invalidCount: invalid,
        unclearCount: unclear,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, id));
  }

  async getValidationsByIssue(issueId: string): Promise<Validation[]> {
    return db
      .select()
      .from(validations)
      .where(eq(validations.issueId, issueId));
  }

  async getUserValidation(
    userId: string,
    issueId: string,
  ): Promise<Validation | undefined> {
    const [validation] = await db
      .select()
      .from(validations)
      .where(
        and(
          eq(validations.userId, userId),
          eq(validations.issueId, issueId),
        ),
      );
    return validation || undefined;
  }

  async getUserValidations(userId: string): Promise<Validation[]> {
    return db
      .select()
      .from(validations)
      .where(eq(validations.userId, userId));
  }

  async createValidation(validation: InsertValidation): Promise<Validation> {
    const [newValidation] = await db
      .insert(validations)
      .values(validation)
      .returning();
    return newValidation;
  }

  async getCommentsByIssue(issueId: string): Promise<(Comment & { userName: string | null })[]> {
    const result = await db
      .select({
        id: comments.id,
        issueId: comments.issueId,
        userId: comments.userId,
        content: comments.content,
        createdAt: comments.createdAt,
        userName: sql<string>`COALESCE(${users.displayName}, ${users.username})`.as('user_name'),
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.issueId, issueId))
      .orderBy(desc(comments.createdAt));
    return result;
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [newComment] = await db
      .insert(comments)
      .values(comment)
      .returning();
    return newComment;
  }

  async getStatusUpdatesByIssue(issueId: string): Promise<StatusUpdate[]> {
    return db
      .select()
      .from(statusUpdates)
      .where(eq(statusUpdates.issueId, issueId))
      .orderBy(desc(statusUpdates.createdAt));
  }

  async createStatusUpdate(
    issueId: string,
    fromStatus: string,
    toStatus: string,
    note?: string,
  ): Promise<StatusUpdate> {
    const [update] = await db
      .insert(statusUpdates)
      .values({ issueId, fromStatus, toStatus, note })
      .returning();
    return update;
  }

  async getBadges(): Promise<Badge[]> {
    return db.select().from(badges);
  }

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    return db
      .select()
      .from(userBadges)
      .where(eq(userBadges.userId, userId));
  }

  async awardBadge(userId: string, badgeId: string): Promise<UserBadge> {
    const [badge] = await db
      .insert(userBadges)
      .values({ userId, badgeId })
      .returning();
    return badge;
  }

  async getDepartments(): Promise<Department[]> {
    return db.select().from(departments).orderBy(desc(departments.createdAt));
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [department] = await db.select().from(departments).where(eq(departments.id, id));
    return department || undefined;
  }

  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db.insert(departments).values(department).returning();
    return newDepartment;
  }

  async updateDepartment(id: string, data: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [department] = await db
      .update(departments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return department || undefined;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id)).returning();
    return result.length > 0;
  }

  async getAdminUsers(): Promise<AdminUser[]> {
    return db.select().from(adminUsers).orderBy(desc(adminUsers.createdAt));
  }

  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const [adminUser] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return adminUser || undefined;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const [adminUser] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return adminUser || undefined;
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | undefined> {
    const [adminUser] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    return adminUser || undefined;
  }

  async createAdminUser(adminUser: InsertAdminUser): Promise<AdminUser> {
    const [newAdminUser] = await db.insert(adminUsers).values(adminUser).returning();
    return newAdminUser;
  }

  async updateAdminUser(id: string, data: Partial<InsertAdminUser>): Promise<AdminUser | undefined> {
    const [adminUser] = await db
      .update(adminUsers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();
    return adminUser || undefined;
  }

  async updateAdminUserLastActive(id: string): Promise<void> {
    await db
      .update(adminUsers)
      .set({ lastActiveAt: new Date() })
      .where(eq(adminUsers.id, id));
  }

  async deleteAdminUser(id: string): Promise<boolean> {
    const result = await db.delete(adminUsers).where(eq(adminUsers.id, id)).returning();
    return result.length > 0;
  }

  async getResolvers(): Promise<Resolver[]> {
    return db.select().from(resolvers).orderBy(desc(resolvers.createdAt));
  }

  async getResolver(id: string): Promise<Resolver | undefined> {
    const [resolver] = await db.select().from(resolvers).where(eq(resolvers.id, id));
    return resolver || undefined;
  }

  async createResolver(resolver: InsertResolver): Promise<Resolver> {
    const [newResolver] = await db.insert(resolvers).values(resolver).returning();
    return newResolver;
  }

  async updateResolver(id: string, data: Partial<InsertResolver>): Promise<Resolver | undefined> {
    const [resolver] = await db
      .update(resolvers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(resolvers.id, id))
      .returning();
    return resolver || undefined;
  }

  async deleteResolver(id: string): Promise<boolean> {
    const result = await db.delete(resolvers).where(eq(resolvers.id, id)).returning();
    return result.length > 0;
  }

  async incrementResolverLoad(resolverId: string): Promise<void> {
    await db
      .update(resolvers)
      .set({ currentLoad: sql`${resolvers.currentLoad} + 1` })
      .where(eq(resolvers.id, resolverId));
  }

  async incrementResolverResolved(resolverId: string): Promise<void> {
    await db
      .update(resolvers)
      .set({ 
        totalResolved: sql`${resolvers.totalResolved} + 1`,
        currentLoad: sql`GREATEST(${resolvers.currentLoad} - 1, 0)`
      })
      .where(eq(resolvers.id, resolverId));
  }

  async getResolverByAdminUserId(adminUserId: string): Promise<Resolver | undefined> {
    const [resolver] = await db.select().from(resolvers).where(eq(resolvers.adminUserId, adminUserId));
    return resolver || undefined;
  }

  async getResolverAssignments(resolverId: string): Promise<(IssueAssignment & { issue: Issue | null })[]> {
    const assignments = await db
      .select()
      .from(issueAssignments)
      .where(eq(issueAssignments.resolverId, resolverId))
      .orderBy(desc(issueAssignments.createdAt));
    
    const result = await Promise.all(
      assignments.map(async (assignment) => {
        const issue = await this.getIssue(assignment.issueId);
        return { ...assignment, issue: issue || null };
      })
    );
    
    return result;
  }

  async updateAssignmentStatus(
    assignmentId: string,
    status: string,
    resolutionImages?: string[],
    notes?: string
  ): Promise<IssueAssignment | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (status === "completed") {
      updateData.completedAt = new Date();
    }
    if (status === "started") {
      updateData.startedAt = new Date();
    }
    if (status === "accepted") {
      updateData.acceptedAt = new Date();
    }
    if (resolutionImages) {
      updateData.resolutionImages = resolutionImages;
    }
    if (notes) {
      updateData.notes = notes;
    }
    
    const [assignment] = await db
      .update(issueAssignments)
      .set(updateData)
      .where(eq(issueAssignments.id, assignmentId))
      .returning();
    
    return assignment || undefined;
  }

  async getResolverLeaderboard(limit = 10): Promise<(Resolver & { adminUser: AdminUser | null })[]> {
    const topResolvers = await db
      .select()
      .from(resolvers)
      .where(eq(resolvers.status, "active"))
      .orderBy(desc(resolvers.totalResolved))
      .limit(limit);
    
    const result = await Promise.all(
      topResolvers.map(async (resolver) => {
        const [adminUser] = await db
          .select()
          .from(adminUsers)
          .where(eq(adminUsers.id, resolver.adminUserId));
        return { ...resolver, adminUser: adminUser || null };
      })
    );
    
    return result;
  }

  async getIssueAssignments(issueId: string): Promise<IssueAssignment[]> {
    return db
      .select()
      .from(issueAssignments)
      .where(eq(issueAssignments.issueId, issueId))
      .orderBy(desc(issueAssignments.createdAt));
  }

  async createIssueAssignment(assignment: InsertIssueAssignment): Promise<IssueAssignment> {
    const [newAssignment] = await db.insert(issueAssignments).values(assignment).returning();
    return newAssignment;
  }

  async getAdminIssues(filters?: {
    status?: string;
    category?: string;
    priority?: string;
    limit?: number;
  }): Promise<Issue[]> {
    let query = db.select().from(issues).$dynamic();
    
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(issues.status, filters.status));
    }
    if (filters?.category) {
      conditions.push(eq(issues.category, filters.category));
    }
    if (filters?.priority) {
      conditions.push(eq(issues.priority, filters.priority));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(issues.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    return query;
  }

  async getDashboardStats(): Promise<{
    totalIssues: number;
    pendingIssues: number;
    resolvedIssues: number;
    resolutionRate: number;
    avgResolutionTime: number;
    activeResolvers: number;
    issuesByCategory: Record<string, number>;
    issuesByStatus: Record<string, number>;
    recentIssues: Issue[];
    mapIssues: Issue[];
    issuesTrend: { date: string; count: number }[];
  }> {
    const [totalIssuesResult] = await db.select({ count: count() }).from(issues);
    const [pendingResult] = await db.select({ count: count() }).from(issues).where(
      or(eq(issues.status, "reported"), eq(issues.status, "verified"), eq(issues.status, "assigned"), eq(issues.status, "in_progress"))
    );
    const [resolvedResult] = await db.select({ count: count() }).from(issues).where(eq(issues.status, "resolved"));
    const [activeResolversResult] = await db.select({ count: count() }).from(resolvers).where(eq(resolvers.status, "active"));
    
    const totalIssues = totalIssuesResult.count;
    const resolvedIssues = resolvedResult.count;
    const resolutionRate = totalIssues > 0 ? (resolvedIssues / totalIssues) * 100 : 0;

    const allIssues = await db.query.issues.findMany({
      with: {
        assignments: {
          with: {
            resolver: {
              with: {
                adminUser: true
              }
            }
          }
        }
      }
    });

    const issuesByCategory: Record<string, number> = {};
    const issuesByStatus: Record<string, number> = {};
    
    for (const issue of allIssues) {
      issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
      issuesByStatus[issue.status] = (issuesByStatus[issue.status] || 0) + 1;
    }

    const sortedIssues = [...allIssues].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const recentIssues = sortedIssues.slice(0, 5);
    const mapIssues = allIssues.filter(i => i.status !== 'resolved' && i.status !== 'closed');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const issuesTrend: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayIssues = allIssues.filter(issue => {
        const issueDate = new Date(issue.createdAt).toISOString().split('T')[0];
        return issueDate === dateStr;
      });
      issuesTrend.push({ date: dateStr, count: dayIssues.length });
    }
    
    const resolvedIssuesList = allIssues.filter(i => i.status === 'resolved' && i.resolvedAt && i.createdAt);
    let totalResolutionHours = 0;
    for (const issue of resolvedIssuesList) {
      const diff = new Date(issue.resolvedAt!).getTime() - new Date(issue.createdAt).getTime();
      totalResolutionHours += diff / (1000 * 60 * 60);
    }
    const avgResolutionTime = resolvedIssuesList.length > 0 ? (Math.round((totalResolutionHours / resolvedIssuesList.length) * 10) / 10) : 0;

    return {
      totalIssues,
      pendingIssues: pendingResult.count,
      resolvedIssues,
      resolutionRate: Math.round(resolutionRate * 10) / 10,
      avgResolutionTime,
      activeResolvers: activeResolversResult.count,
      issuesByCategory,
      issuesByStatus,
      recentIssues,
      mapIssues,
      issuesTrend,
    };
  }

  async getResolverDashboardData(adminUserId: string): Promise<any> {
    const [adminProfile] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminUserId));
    if (!adminProfile || adminProfile.role !== "resolver") throw new Error("Not a valid resolver");
    
    const [resolverProfile] = await db.select().from(resolvers).where(eq(resolvers.adminUserId, adminUserId));
    if (!resolverProfile) throw new Error("Resolver profile not found");
    
    const departmentId = adminProfile.departmentId;

    let activeJob = null;
    const myAssignments = await db
      .select({ assignment: issueAssignments, issue: issues })
      .from(issueAssignments)
      .innerJoin(issues, eq(issueAssignments.issueId, issues.id))
      .where(and(eq(issueAssignments.resolverId, resolverProfile.id), or(eq(issueAssignments.status, "in_progress"), eq(issueAssignments.status, "pending"))))
      .orderBy(desc(issueAssignments.createdAt))
      .limit(1);

    if (myAssignments.length > 0) {
      activeJob = myAssignments[0];
    }

    const allResolvers = await db.select().from(resolvers).innerJoin(adminUsers, eq(resolvers.adminUserId, adminUsers.id));
    const deptScores: Record<string, { id: string; name: string; totalResolved: number }> = {};
    for (const r of allResolvers) {
      const dId = r.admin_users.departmentId;
      if (!dId) continue;
      if (!deptScores[dId]) {
        const [d] = await db.select().from(departments).where(eq(departments.id, dId)).limit(1);
        deptScores[dId] = { id: dId, name: d ? d.name : "Unknown", totalResolved: 0 };
      }
      deptScores[dId].totalResolved += r.resolvers.totalResolved;
    }

    const rankingsList = Object.values(deptScores)
      .sort((a, b) => b.totalResolved - a.totalResolved)
      .map((d, index) => ({
        rank: index + 1,
        departmentId: d.id,
        name: d.name,
        totalResolved: d.totalResolved
      }));

    let priorityQueue: Issue[] = [];
    let departmentSlug = null;
    if (departmentId) {
      const [dept] = await db.select().from(departments).where(eq(departments.id, departmentId));
      if (dept) {
        departmentSlug = dept.slug;
        priorityQueue = await db
          .select()
          .from(issues)
          .where(and(eq(issues.category, dept.slug), or(eq(issues.status, "reported"), eq(issues.status, "verified"))))
          .orderBy(desc(issues.priority))
          .limit(10);
      }
    }

    const [criticalAlert] = await db
      .select()
      .from(issues)
      .where(and(eq(issues.priority, "critical"), or(eq(issues.status, "reported"), eq(issues.status, "verified"))))
      .orderBy(desc(issues.createdAt))
      .limit(1);

    return {
      resolver: {
        totalResolved: resolverProfile.totalResolved,
        uptime: resolverProfile.onTimeDelivery,
        level: Math.floor((resolverProfile.totalResolved * 120) / 1000) + 1,
        xp: resolverProfile.totalResolved * 120,
        name: adminProfile.name
      },
      activeJob: activeJob ? {
        id: activeJob.issue.id,
        assignmentId: activeJob.assignment.id,
        title: activeJob.issue.title,
        address: activeJob.issue.address || activeJob.issue.district || "Unknown Location",
        priority: activeJob.issue.priority,
        status: activeJob.assignment.status,
        latitude: activeJob.issue.latitude,
        longitude: activeJob.issue.longitude,
      } : null,
      departmentRankings: rankingsList,
      myDepartmentId: departmentId,
      myDepartmentSlug: departmentSlug,
      priorityQueue,
      criticalAlert: criticalAlert || null
    };
  }



  async updateAdminUserPushToken(id: string, pushToken: string): Promise<void> {
    await db
      .update(adminUsers)
      .set({ pushToken })
      .where(eq(adminUsers.id, id));
  }

  async updateUserPushToken(id: string, pushToken: string): Promise<void> {
    await db
      .update(users)
      .set({ pushToken })
      .where(eq(users.id, id));
  }

  async notifyUserOfStatusChange(issue: any, newStatus: string): Promise<void> {
    try {
      const reporter = await this.getUser(issue.reporterId);
      if (reporter && reporter.pushToken) {
        const { sendPushNotification } = await import("./push");
        await sendPushNotification(
          reporter.pushToken,
          "📣 Issue Status Updated",
          `Your issue "${issue.title}" is now ${newStatus}.`,
          { issueId: issue.id, type: "status_update" }
        );
      }
    } catch (err) {
      console.error("Failed to notify reporter of status change:", err);
    }
  }

  async notifyUserOfCredits(userId: string, amount: number, reason: string): Promise<void> {
    try {
      const user = await this.getUser(userId);
      if (user && user.pushToken) {
        const { sendPushNotification } = await import("./push");
        await sendPushNotification(
          user.pushToken,
          "🎉 Credits Awarded!",
          `You earned ${amount} credits. ${reason}`,
          { type: "credits_awarded", amount }
        );
      }
    } catch (err) {
      console.error("Failed to notify user of credits:", err);
    }
  }

  async findNearestResolver(
    issueCategory: string,
    issueLat: number,
    issueLng: number
  ): Promise<{ resolver: Resolver; adminUser: AdminUser } | null> {
    // 1. Find department whose categories contain the issue category
    const allDepartments = await db.select().from(departments).where(eq(departments.isActive, true));
    let matchingDepartment: typeof allDepartments[0] | null = null;

    for (const dept of allDepartments) {
      const cats = dept.categories as string[] | null;
      if (cats && cats.includes(issueCategory)) {
        matchingDepartment = dept;
        break;
      }
    }

    // Also try matching department slug directly against issue category
    if (!matchingDepartment) {
      for (const dept of allDepartments) {
        if (dept.slug === issueCategory) {
          matchingDepartment = dept;
          break;
        }
      }
    }

    if (!matchingDepartment) {
      console.warn(`No department found for category: ${issueCategory}`);
      return null;
    }

    // 2. Find active resolvers in this department
    const deptAdminUsers = await db
      .select()
      .from(adminUsers)
      .where(
        and(
          eq(adminUsers.departmentId, matchingDepartment.id),
          eq(adminUsers.role, "resolver"),
          eq(adminUsers.status, "active")
        )
      );

    if (deptAdminUsers.length === 0) {
      console.warn(`No active resolvers found for department: ${matchingDepartment.name}`);
      return null;
    }

    // 3. Get resolver profiles for these admin users
    const resolverProfiles: { resolver: Resolver; adminUser: AdminUser }[] = [];
    for (const au of deptAdminUsers) {
      const [resolver] = await db
        .select()
        .from(resolvers)
        .where(and(eq(resolvers.adminUserId, au.id), eq(resolvers.status, "active")));
      if (resolver) {
        resolverProfiles.push({ resolver, adminUser: au });
      }
    }

    if (resolverProfiles.length === 0) {
      console.warn(`No active resolver profiles for department: ${matchingDepartment.name}`);
      return null;
    }

    // 4. Sort by distance (Haversine), then by lowest currentLoad
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    resolverProfiles.sort((a, b) => {
      const aHasLoc = a.resolver.latitude != null && a.resolver.longitude != null;
      const bHasLoc = b.resolver.latitude != null && b.resolver.longitude != null;

      if (aHasLoc && bHasLoc) {
        const distA = haversine(issueLat, issueLng, a.resolver.latitude!, a.resolver.longitude!);
        const distB = haversine(issueLat, issueLng, b.resolver.latitude!, b.resolver.longitude!);
        if (Math.abs(distA - distB) > 0.5) return distA - distB; // >500m difference matters
      }

      // Fall back to lowest current load
      return a.resolver.currentLoad - b.resolver.currentLoad;
    });

    return resolverProfiles[0];
  }
}

export const storage = new DatabaseStorage();
