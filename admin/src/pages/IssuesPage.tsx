import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Eye,
  MapPin,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  UserCheck,
  Image as ImageIcon,
  ChevronRight,
  AlertTriangle,
  Camera,
} from 'lucide-react';
import { adminApi, Issue, Resolver, AdminUser, IssueAssignment, Department } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import {
  formatDate,
  formatDateTime,
  getCategoryColor,
} from '../lib/utils';
import DataTable from '../components/DataTable';
import { Card, CardContent, CardHeader } from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Badge, { getStatusBadgeVariant, getPriorityBadgeVariant } from '../components/Badge';

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'reported', label: 'Reported' },
  { value: 'verified', label: 'Verified' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const categoryOptions = [
  { value: 'all', label: 'All Categories' },
  { value: 'roads', label: 'Roads' },
  { value: 'water', label: 'Water' },
  { value: 'waste', label: 'Waste' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'drainage', label: 'Drainage' },
  { value: 'parks', label: 'Parks' },
  { value: 'other', label: 'Other' },
];

const priorityOptions = [
  { value: 'all', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const IssuesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewingIssue, setViewingIssue] = useState<Issue | null>(null);
  const [assigningIssue, setAssigningIssue] = useState<Issue | null>(null);
  const [selectedResolverId, setSelectedResolverId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['issues'],
    queryFn: () => adminApi.getIssues().then((res) => res.data),
  });

  const { data: resolvers = [] } = useQuery({
    queryKey: ['resolvers'],
    queryFn: () => adminApi.getResolvers().then((res) => res.data),
  });

  const { data: adminUsers = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getAdminUsers().then((res) => res.data),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => adminApi.getDepartments().then((res) => res.data),
  });

  const { data: issueAssignments = [] } = useQuery({
    queryKey: ['issue-assignments', viewingIssue?.id],
    queryFn: () => viewingIssue ? adminApi.getIssueAssignments(viewingIssue.id).then((res) => res.data) : [],
    enabled: !!viewingIssue,
  });

  const completedAssignment = issueAssignments.find((a: IssueAssignment) => a.status === 'completed');
  const resolutionPhotos = completedAssignment?.resolutionImages || [];

  const assignMutation = useMutation({
    mutationFn: ({
      issueId,
      resolverId,
      assignedBy,
      notes,
    }: {
      issueId: string;
      resolverId: string;
      assignedBy: string;
      notes?: string;
    }) => adminApi.assignIssue(issueId, resolverId, assignedBy, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      handleCloseAssignModal();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateIssueStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });

  const handleCloseAssignModal = () => {
    setAssigningIssue(null);
    setSelectedResolverId('');
    setAssignmentNotes('');
  };

  const handleAssignSubmit = () => {
    if (assigningIssue && selectedResolverId && user) {
      assignMutation.mutate({
        issueId: assigningIssue.id,
        resolverId: selectedResolverId,
        assignedBy: user.id,
        notes: assignmentNotes || undefined,
      });
    }
  };

  const handleStatusChange = (issue: Issue, newStatus: string) => {
    updateStatusMutation.mutate({ id: issue.id, status: newStatus });
    if (viewingIssue?.id === issue.id) {
      setViewingIssue({ ...viewingIssue, status: newStatus });
    }
  };

  const availableResolvers = useMemo((): Resolver[] => {
    const activeResolvers = resolvers.filter((r: Resolver) => r.status === 'active');

    if (!assigningIssue) {
      return activeResolvers;
    }

    const issueDepartment = departments.find((dept: Department) =>
      dept.categories && dept.categories.includes(assigningIssue.category)
    );

    if (!issueDepartment) {
      return activeResolvers;
    }

    return activeResolvers.filter((resolver: Resolver) => {
      const adminUser = adminUsers.find((u: AdminUser) => u.id === resolver.adminUserId);
      return adminUser?.departmentId === issueDepartment.id;
    });
  }, [resolvers, assigningIssue, departments, adminUsers]);

  const filteredIssues = useMemo((): Issue[] => {
    return issues.filter((issue: Issue) => {
      const matchesSearch = issue.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' || issue.status === statusFilter;
      const matchesCategory =
        categoryFilter === 'all' || issue.category === categoryFilter;
      const matchesPriority =
        priorityFilter === 'all' || issue.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
    });
  }, [issues, searchQuery, statusFilter, categoryFilter, priorityFilter]);

  const issueStats = useMemo(() => {
    const total = issues.length;
    const reported = issues.filter((i: Issue) => i.status === 'reported').length;
    const inProgress = issues.filter(
      (i: Issue) => i.status === 'in_progress' || i.status === 'assigned'
    ).length;
    const resolved = issues.filter((i: Issue) => i.status === 'resolved').length;
    const critical = issues.filter((i: Issue) => i.priority === 'critical').length;
    return { total, reported, inProgress, resolved, critical };
  }, [issues]);

  const columns = [
    {
      key: 'title',
      header: 'Title',
      render: (issue: Issue) => (
        <div className="max-w-[200px]">
          <div className="font-medium text-gray-900 dark:text-white truncate">{issue.title}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {issue.description?.slice(0, 50)}...
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (issue: Issue) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(
            issue.category
          )}`}
        >
          {issue.category}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (issue: Issue) => (
        <Badge variant={getPriorityBadgeVariant(issue.priority)}>
          {issue.priority}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (issue: Issue) => (
        <Badge variant={getStatusBadgeVariant(issue.status)}>
          {issue.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (issue: Issue) => (
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 text-sm">
          <MapPin className="h-3.5 w-3.5" />
          <span className="truncate max-w-[120px]">
            {issue.address || issue.district || 'N/A'}
          </span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (issue: Issue) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(issue.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (issue: Issue) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewingIssue(issue);
            }}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          {(issue.status === 'reported' || issue.status === 'verified') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAssigningIssue(issue);
              }}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
              title="Assign Resolver"
            >
              <UserCheck className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const getStatusTimeline = (issue: Issue) => {
    const timeline = [
      {
        status: 'Reported',
        date: issue.createdAt,
        icon: AlertCircle,
        completed: true,
      },
    ];

    if (issue.verifiedCount > 0) {
      timeline.push({
        status: 'Verified',
        date: issue.updatedAt,
        icon: CheckCircle2,
        completed: issue.status !== 'reported',
      });
    }

    if (issue.status === 'assigned' || issue.status === 'in_progress' || issue.status === 'resolved') {
      timeline.push({
        status: 'Assigned',
        date: issue.updatedAt,
        icon: UserCheck,
        completed: true,
      });
    }

    if (issue.status === 'in_progress' || issue.status === 'resolved') {
      timeline.push({
        status: 'In Progress',
        date: issue.updatedAt,
        icon: Clock,
        completed: true,
      });
    }

    if (issue.status === 'resolved') {
      timeline.push({
        status: 'Resolved',
        date: issue.resolvedAt || issue.updatedAt,
        icon: CheckCircle2,
        completed: true,
      });
    }

    return timeline;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Issues Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track and manage all civic issues</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {issueStats.total}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Issues</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {issueStats.reported}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Reported</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <ChevronRight className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {issueStats.inProgress}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">In Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {issueStats.resolved}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Resolved</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {issueStats.critical}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Critical</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search issues by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredIssues}
            keyExtractor={(issue) => issue.id}
            isLoading={isLoading}
            emptyMessage="No issues found"
            onRowClick={(issue) => setViewingIssue(issue)}
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={!!viewingIssue}
        onClose={() => {
          setViewingIssue(null);
          setSelectedImageIndex(null);
        }}
        title="Issue Details"
        size="xl"
      >
        {viewingIssue && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {viewingIssue.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant={getStatusBadgeVariant(viewingIssue.status)}>
                    {viewingIssue.status.replace('_', ' ')}
                  </Badge>
                  <Badge variant={getPriorityBadgeVariant(viewingIssue.priority)}>
                    {viewingIssue.priority}
                  </Badge>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                      viewingIssue.category
                    )}`}
                  >
                    {viewingIssue.category}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Update Status
                </label>
                <select
                  value={viewingIssue.status}
                  onChange={(e) => handleStatusChange(viewingIssue, e.target.value)}
                  disabled={updateStatusMutation.isPending}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                >
                  <option value="reported">Reported</option>
                  <option value="verified">Verified</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{viewingIssue.description}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {viewingIssue.address || 'No address provided'}
                  </p>
                  {viewingIssue.district && (
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                      District: {viewingIssue.district}
                    </p>
                  )}
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                    Coordinates: {viewingIssue.latitude.toFixed(6)},{' '}
                    {viewingIssue.longitude.toFixed(6)}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Timeline
                  </h4>
                  <div className="flex flex-col gap-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Created:</span>{' '}
                      {formatDateTime(viewingIssue.createdAt)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Updated:</span>{' '}
                      {formatDateTime(viewingIssue.updatedAt)}
                    </div>
                    {viewingIssue.resolvedAt && (
                      <div className="text-sm text-green-600">
                        <span className="font-medium">Resolved:</span>{' '}
                        {formatDateTime(viewingIssue.resolvedAt)}
                      </div>
                    )}
                    {viewingIssue.slaDeadline && (
                      <div className="text-sm text-orange-600">
                        <span className="font-medium">SLA Deadline:</span>{' '}
                        {formatDateTime(viewingIssue.slaDeadline)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Validation Counts
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg text-center">
                      <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-400">
                        {viewingIssue.verifiedCount}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-500">Verified</div>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg text-center">
                      <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                        <XCircle className="h-4 w-4" />
                      </div>
                      <div className="text-xl font-bold text-red-700 dark:text-red-400">
                        {viewingIssue.invalidCount}
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-500">Invalid</div>
                    </div>
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg text-center">
                      <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div className="text-xl font-bold text-orange-700 dark:text-orange-400">
                        {viewingIssue.unclearCount}
                      </div>
                      <div className="text-xs text-orange-600 dark:text-orange-500">Unclear</div>
                    </div>
                  </div>
                </div>

                {viewingIssue.assignedDepartment && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Assignment
                    </h4>
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                      <p className="text-sm text-purple-800 dark:text-purple-300">
                        Assigned to Department: {viewingIssue.assignedDepartment}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status Timeline
                  </h4>
                  <div className="relative">
                    <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gray-200 dark:bg-gray-700" />
                    <div className="space-y-3">
                      {getStatusTimeline(viewingIssue).map((item, index) => (
                        <div key={index} className="flex items-start gap-3 relative">
                          <div
                            className={`z-10 p-1 rounded-full ${item.completed
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                              }`}
                          >
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p
                              className={`text-sm font-medium ${item.completed ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                                }`}
                            >
                              {item.status}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDateTime(item.date)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {viewingIssue.images && viewingIssue.images.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Reported Images ({viewingIssue.images.length})
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {viewingIssue.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={image}
                        alt={`Issue image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {resolutionPhotos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Resolution Photos ({resolutionPhotos.length})
                </h4>
                <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg mb-3">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Issue resolved by field worker on {completedAssignment?.completedAt ? formatDateTime(completedAssignment.completedAt) : 'N/A'}</span>
                  </div>
                  {completedAssignment?.notes && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Notes: {completedAssignment.notes}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {resolutionPhotos.map((image: string, index: number) => (
                    <div
                      key={index}
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-green-500"
                    >
                      <img
                        src={image}
                        alt={`Resolution photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setViewingIssue(null)}
              >
                Close
              </Button>
              {(viewingIssue.status === 'reported' ||
                viewingIssue.status === 'verified') && (
                  <Button
                    onClick={() => {
                      setAssigningIssue(viewingIssue);
                      setViewingIssue(null);
                    }}
                    leftIcon={<UserCheck className="h-4 w-4" />}
                  >
                    Assign Resolver
                  </Button>
                )}
            </div>
          </div>
        )}
      </Modal>

      {viewingIssue && selectedImageIndex !== null && viewingIssue.images && (
        <Modal
          isOpen={selectedImageIndex !== null}
          onClose={() => setSelectedImageIndex(null)}
          size="xl"
        >
          <div className="flex flex-col items-center">
            <img
              src={viewingIssue.images[selectedImageIndex]}
              alt={`Issue image ${selectedImageIndex + 1}`}
              className="max-h-[60vh] max-w-full object-contain rounded-lg"
            />
            <div className="flex items-center gap-4 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={selectedImageIndex === 0}
                onClick={() => setSelectedImageIndex(selectedImageIndex - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedImageIndex + 1} of {viewingIssue.images.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedImageIndex === viewingIssue.images.length - 1}
                onClick={() => setSelectedImageIndex(selectedImageIndex + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={!!assigningIssue}
        onClose={handleCloseAssignModal}
        title="Assign Issue to Resolver"
        size="md"
      >
        {assigningIssue && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white">{assigningIssue.title}</h4>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant={getPriorityBadgeVariant(assigningIssue.priority)}>
                  {assigningIssue.priority}
                </Badge>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                    assigningIssue.category
                  )}`}
                >
                  {assigningIssue.category}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Select Resolver
              </label>
              <select
                value={selectedResolverId}
                onChange={(e) => setSelectedResolverId(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
              >
                <option value="">Choose a resolver...</option>
                {availableResolvers.map((resolver: Resolver) => {
                  const adminUser = adminUsers.find(
                    (u: AdminUser) => u.id === resolver.adminUserId
                  );
                  return (
                    <option key={resolver.id} value={resolver.id}>
                      {adminUser?.name || 'Unknown'} ({resolver.currentLoad} current
                      issues)
                    </option>
                  );
                })}
              </select>
              {availableResolvers.length === 0 && (
                <p className="mt-1.5 text-sm text-amber-600">
                  No active resolvers available. Please add resolvers first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Assignment Notes (Optional)
              </label>
              <textarea
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                placeholder="Add any notes for the resolver..."
                rows={3}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={handleCloseAssignModal}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignSubmit}
                isLoading={assignMutation.isPending}
                disabled={!selectedResolverId || !user || authLoading}
                leftIcon={<UserCheck className="h-4 w-4" />}
              >
                Assign Resolver
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
};

export default IssuesPage;
