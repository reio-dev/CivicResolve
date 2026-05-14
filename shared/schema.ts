import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  doublePrecision,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const departments = pgTable("departments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  categories: jsonb("categories").$type<string[]>().default([]),
  color: text("color").default("#6366F1"),
  icon: text("icon").default("briefcase"),
  slaHours: integer("sla_hours").default(72).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminUsers = pgTable("admin_users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email"),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("resolver"),
  departmentId: varchar("department_id").references(() => departments.id),
  status: text("status").notNull().default("active"),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const resolvers = pgTable("resolvers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id")
    .notNull()
    .references(() => adminUsers.id),
  employeeId: text("employee_id"),
  specializations: jsonb("specializations").$type<string[]>().default([]),
  jurisdictionAreas: jsonb("jurisdiction_areas").$type<string[]>().default([]),
  currentLoad: integer("current_load").default(0).notNull(),
  totalResolved: integer("total_resolved").default(0).notNull(),
  avgResolutionTime: integer("avg_resolution_time"),
  rating: doublePrecision("rating").default(0),
  onTimeDelivery: doublePrecision("on_time_delivery").default(100),
  shiftStart: text("shift_start"),
  shiftEnd: text("shift_end"),
  shiftDays: jsonb("shift_days").$type<string[]>().default([]),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationUpdatedAt: timestamp("location_updated_at"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const issueAssignments = pgTable("issue_assignments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  issueId: varchar("issue_id")
    .notNull()
    .references(() => issues.id),
  resolverId: varchar("resolver_id")
    .notNull()
    .references(() => resolvers.id),
  assignedBy: varchar("assigned_by")
    .notNull()
    .references(() => adminUsers.id),
  status: text("status").notNull().default("pending"),
  acceptedAt: timestamp("accepted_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  resolutionImages: jsonb("resolution_images").$type<string[]>().default([]),
  rating: integer("rating"),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const departmentsRelations = relations(departments, ({ many }) => ({
  adminUsers: many(adminUsers),
}));

export const adminUsersRelations = relations(adminUsers, ({ one, many }) => ({
  department: one(departments, {
    fields: [adminUsers.departmentId],
    references: [departments.id],
  }),
  resolver: one(resolvers),
}));

export const resolversRelations = relations(resolvers, ({ one, many }) => ({
  adminUser: one(adminUsers, {
    fields: [resolvers.adminUserId],
    references: [adminUsers.id],
  }),
  assignments: many(issueAssignments),
}));

export const issueAssignmentsRelations = relations(issueAssignments, ({ one }) => ({
  issue: one(issues, {
    fields: [issueAssignments.issueId],
    references: [issues.id],
  }),
  resolver: one(resolvers, {
    fields: [issueAssignments.resolverId],
    references: [resolvers.id],
  }),
  assignedByAdmin: one(adminUsers, {
    fields: [issueAssignments.assignedBy],
    references: [adminUsers.id],
  }),
}));

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  points: integer("points").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  issuesReported: integer("issues_reported").default(0).notNull(),
  issuesResolved: integer("issues_resolved").default(0).notNull(),
  validationsGiven: integer("validations_given").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  issues: many(issues),
  validations: many(validations),
  comments: many(comments),
}));

export const issues = pgTable("issues", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("reported"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  address: text("address"),
  district: text("district"),
  images: jsonb("images").$type<string[]>().default([]),
  reporterId: varchar("reporter_id")
    .notNull()
    .references(() => users.id),
  verifiedCount: integer("verified_count").default(0).notNull(),
  invalidCount: integer("invalid_count").default(0).notNull(),
  unclearCount: integer("unclear_count").default(0).notNull(),
  governmentResponse: text("government_response"),
  assignedDepartment: text("assigned_department"),
  slaDeadline: timestamp("sla_deadline"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const issuesRelations = relations(issues, ({ one, many }) => ({
  reporter: one(users, {
    fields: [issues.reporterId],
    references: [users.id],
  }),
  validations: many(validations),
  comments: many(comments),
  statusUpdates: many(statusUpdates),
}));

export const validations = pgTable("validations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  issueId: varchar("issue_id")
    .notNull()
    .references(() => issues.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  vote: text("vote").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const validationsRelations = relations(validations, ({ one }) => ({
  issue: one(issues, {
    fields: [validations.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [validations.userId],
    references: [users.id],
  }),
}));

export const comments = pgTable("comments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  issueId: varchar("issue_id")
    .notNull()
    .references(() => issues.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const commentsRelations = relations(comments, ({ one }) => ({
  issue: one(issues, {
    fields: [comments.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const statusUpdates = pgTable("status_updates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  issueId: varchar("issue_id")
    .notNull()
    .references(() => issues.id),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const statusUpdatesRelations = relations(statusUpdates, ({ one }) => ({
  issue: one(issues, {
    fields: [statusUpdates.issueId],
    references: [issues.id],
  }),
}));

export const badges = pgTable("badges", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  iconName: text("icon_name").notNull(),
  pointsRequired: integer("points_required").default(0).notNull(),
  category: text("category").notNull(),
});

export const userBadges = pgTable("user_badges", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  badgeId: varchar("badge_id")
    .notNull()
    .references(() => badges.id),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
});

export const insertIssueSchema = createInsertSchema(issues).omit({
  id: true,
  verifiedCount: true,
  invalidCount: true,
  unclearCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertValidationSchema = createInsertSchema(validations).omit({
  id: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  lastActiveAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertResolverSchema = createInsertSchema(resolvers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIssueAssignmentSchema = createInsertSchema(issueAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type InsertIssue = z.infer<typeof insertIssueSchema>;
export type Validation = typeof validations.$inferSelect;
export type InsertValidation = z.infer<typeof insertValidationSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type StatusUpdate = typeof statusUpdates.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type Resolver = typeof resolvers.$inferSelect;
export type InsertResolver = z.infer<typeof insertResolverSchema>;
export type IssueAssignment = typeof issueAssignments.$inferSelect;
export type InsertIssueAssignment = z.infer<typeof insertIssueAssignmentSchema>;
