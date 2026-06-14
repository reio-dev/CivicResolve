import axios from 'axios';

// Use VITE_API_URL for production, fallback to /api for local dev
const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export interface AdminUser {
  id: string;
  username: string;
  email?: string;
  name: string;
  phone?: string;
  role: 'super_admin' | 'admin' | 'resolver';
  departmentId?: string;
  status: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  slug: string;
  description?: string;
  categories: string[];
  color: string;
  icon: string;
  slaHours: number;
  isActive: boolean;
  createdAt: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  latitude: number;
  longitude: number;
  address?: string;
  district?: string;
  images: string[];
  reporterId: string;
  verifiedCount: number;
  invalidCount: number;
  unclearCount: number;
  assignedDepartment?: string;
  slaDeadline?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Resolver {
  id: string;
  adminUserId: string;
  employeeId?: string;
  specializations: string[];
  jurisdictionAreas: string[];
  currentLoad: number;
  totalResolved: number;
  avgResolutionTime?: number;
  rating: number;
  onTimeDelivery: number;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  adminUser?: AdminUser;
}

export interface IssueAssignment {
  id: string;
  issueId: string;
  resolverId: string;
  assignedBy: string;
  status: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  resolutionImages?: string[];
  rating?: number;
  feedback?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalIssues: number;
  pendingIssues: number;
  resolvedIssues: number;
  resolutionRate: number;
  avgResolutionTime: number;
  activeResolvers: number;
  issuesByCategory: Record<string, number>;
  issuesByStatus: Record<string, number>;
  recentIssues: (Issue & {
    assignments?: (IssueAssignment & {
      resolver?: Resolver & {
        adminUser?: AdminUser;
      };
    })[];
  })[];
  mapIssues?: (Issue & {
    assignments?: (IssueAssignment & {
      resolver?: Resolver & {
        adminUser?: AdminUser;
      };
    })[];
  })[];
  issuesTrend: { date: string; count: number }[];
}

export const adminApi = {
  login: (username: string, password: string) =>
    api.post<{ user: AdminUser; token: string }>('/admin/auth/login', { username, password }),

  getDashboardStats: () =>
    api.get<DashboardStats>('/admin/dashboard/stats'),

  getDepartments: () =>
    api.get<Department[]>('/admin/departments'),

  createDepartment: (data: Partial<Department>) =>
    api.post<Department>('/admin/departments', data),

  updateDepartment: (id: string, data: Partial<Department>) =>
    api.patch<Department>(`/admin/departments/${id}`, data),

  deleteDepartment: (id: string) =>
    api.delete(`/admin/departments/${id}`),

  getAdminUsers: () =>
    api.get<AdminUser[]>('/admin/users'),

  createAdminUser: (data: Partial<AdminUser> & { password: string }) =>
    api.post<AdminUser>('/admin/users', data),

  updateAdminUser: (id: string, data: Partial<AdminUser>) =>
    api.patch<AdminUser>(`/admin/users/${id}`, data),

  deleteAdminUser: (id: string) =>
    api.delete(`/admin/users/${id}`),

  getAppUsers: () =>
    api.get<any[]>('/admin/app-users'),

  addCredits: (userId: string, amount: number) =>
    api.post<{ message: string, credits: number }>(`/admin/users/${userId}/credits`, { amount }),

  getResolvers: () =>
    api.get<Resolver[]>('/admin/resolvers'),

  createResolver: (data: Partial<Resolver>) =>
    api.post<Resolver>('/admin/resolvers', data),

  updateResolver: (id: string, data: Partial<Resolver>) =>
    api.patch<Resolver>(`/admin/resolvers/${id}`, data),

  getIssues: (params?: { status?: string; category?: string; department?: string }) =>
    api.get<Issue[]>('/admin/issues', { params }),

  getIssue: (id: string) =>
    api.get<Issue>(`/admin/issues/${id}`),

  assignIssue: (issueId: string, resolverId: string, assignedBy: string, notes?: string) =>
    api.post(`/admin/issues/${issueId}/assign`, { resolverId, assignedBy, notes }),

  updateIssueStatus: (id: string, status: string) =>
    api.patch(`/admin/issues/${id}/status`, { status }),

  getIssueAssignments: (issueId: string) =>
    api.get<IssueAssignment[]>(`/admin/issues/${issueId}/assignments`),
};
