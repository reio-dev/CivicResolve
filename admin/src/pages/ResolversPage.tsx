import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Plus, Search, Eye, Filter, Star, TrendingUp, Clock, CheckCircle2, UserCog } from 'lucide-react';
import { adminApi, Resolver } from '../lib/api';
import DataTable from '../components/DataTable';
import { Card, CardContent, CardHeader } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import Badge from '../components/Badge';

const resolverSchema = z.object({
  adminUserId: z.string().min(1, 'Admin user is required'),
  employeeId: z.string().optional(),
  specializations: z.array(z.string()).min(1, 'At least one specialization is required'),
  jurisdictionAreas: z.array(z.string()).optional(),
  status: z.string().default('active'),
});

type ResolverFormData = z.infer<typeof resolverSchema>;

const specializationOptions = [
  'roads', 'water', 'waste', 'electricity', 'drainage', 'parks',
  'streetlights', 'sewage', 'buildings', 'traffic', 'environment'
];

const ResolversPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingResolver, setViewingResolver] = useState<Resolver | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: resolvers = [], isLoading } = useQuery({
    queryKey: ['resolvers'],
    queryFn: () => adminApi.getResolvers().then(res => res.data),
  });

  const { data: adminUsers = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getAdminUsers().then(res => res.data),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => adminApi.getDepartments().then(res => res.data),
  });

  const availableUsers = useMemo(() => {
    const resolverUserIds = resolvers.map(r => r.adminUserId);
    return adminUsers.filter(u => 
      u.role === 'resolver' && !resolverUserIds.includes(u.id)
    );
  }, [adminUsers, resolvers]);

  const createMutation = useMutation({
    mutationFn: (data: ResolverFormData) => adminApi.createResolver(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resolvers'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ResolverFormData> }) =>
      adminApi.updateResolver(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resolvers'] });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ResolverFormData>({
    resolver: zodResolver(resolverSchema),
    defaultValues: {
      specializations: [],
      jurisdictionAreas: [],
      status: 'active',
    },
  });

  const selectedSpecializations = watch('specializations') || [];

  const handleOpenModal = () => {
    reset({
      adminUserId: '',
      employeeId: '',
      specializations: [],
      jurisdictionAreas: [],
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    reset();
  };

  const onSubmit = (data: ResolverFormData) => {
    createMutation.mutate(data);
  };

  const toggleSpecialization = (spec: string) => {
    const current = selectedSpecializations;
    if (current.includes(spec)) {
      setValue('specializations', current.filter(s => s !== spec));
    } else {
      setValue('specializations', [...current, spec]);
    }
  };

  const getAdminUser = (adminUserId: string) => {
    return adminUsers.find(u => u.id === adminUserId);
  };

  const getDepartmentName = (departmentId?: string) => {
    if (!departmentId) return '-';
    const dept = departments.find(d => d.id === departmentId);
    return dept?.name || '-';
  };

  const filteredResolvers = useMemo(() => {
    return resolvers.filter((resolver) => {
      const adminUser = getAdminUser(resolver.adminUserId);
      const matchesSearch = adminUser?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resolver.employeeId?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDepartment = departmentFilter === 'all' || adminUser?.departmentId === departmentFilter;
      const matchesStatus = statusFilter === 'all' || resolver.status === statusFilter;
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [resolvers, searchQuery, departmentFilter, statusFilter, adminUsers]);

  const getLoadBadgeVariant = (load: number) => {
    if (load <= 3) return 'success';
    if (load <= 7) return 'warning';
    return 'danger';
  };

  const getStatusBadgeVariant = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
      active: 'success',
      busy: 'warning',
      unavailable: 'danger',
      inactive: 'default',
    };
    return variants[status] || 'default';
  };

  const columns = [
    {
      key: 'name',
      header: 'Resolver',
      render: (resolver: Resolver) => {
        const user = getAdminUser(resolver.adminUserId);
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
              {user?.name?.charAt(0)?.toUpperCase() || 'R'}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{user?.name || 'Unknown'}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{resolver.employeeId || user?.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'department',
      header: 'Department',
      render: (resolver: Resolver) => {
        const user = getAdminUser(resolver.adminUserId);
        return getDepartmentName(user?.departmentId);
      },
    },
    {
      key: 'currentLoad',
      header: 'Current Load',
      render: (resolver: Resolver) => (
        <Badge variant={getLoadBadgeVariant(resolver.currentLoad)}>
          {resolver.currentLoad} issues
        </Badge>
      ),
    },
    {
      key: 'totalResolved',
      header: 'Total Resolved',
      render: (resolver: Resolver) => (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="font-medium">{resolver.totalResolved}</span>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (resolver: Resolver) => (
        <div className="flex items-center gap-1.5">
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          <span className="font-medium">{resolver.rating.toFixed(1)}</span>
          <span className="text-gray-400 dark:text-gray-500 text-sm">({resolver.onTimeDelivery}% on-time)</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (resolver: Resolver) => (
        <Badge variant={getStatusBadgeVariant(resolver.status)}>
          {resolver.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (resolver: Resolver) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setViewingResolver(resolver);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Resolver Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage issue resolvers and track performance</p>
        </div>
        <Button 
          onClick={handleOpenModal} 
          leftIcon={<Plus className="h-4 w-4" />}
          disabled={availableUsers.length === 0}
        >
          Add Resolver
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <UserCog className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{resolvers.length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Resolvers</div>
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
                  {resolvers.reduce((acc, r) => acc + r.totalResolved, 0)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Issues Resolved</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {resolvers.length > 0
                    ? (resolvers.reduce((acc, r) => acc + r.rating, 0) / resolvers.length).toFixed(1)
                    : '0.0'}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Avg Rating</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {resolvers.length > 0
                    ? (resolvers.reduce((acc, r) => acc + r.onTimeDelivery, 0) / resolvers.length).toFixed(0)
                    : '0'}%
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Avg On-Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search resolvers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:bg-gray-800 dark:text-white"
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="busy">Busy</option>
                <option value="unavailable">Unavailable</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredResolvers}
            keyExtractor={(resolver) => resolver.id}
            isLoading={isLoading}
            emptyMessage="No resolvers found"
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Create Resolver"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Admin User
            </label>
            <select
              {...register('adminUserId')}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
            >
              <option value="">Select admin user</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
            {availableUsers.length === 0 && (
              <p className="mt-1.5 text-sm text-amber-600">
                No available users with resolver role. Create a user with resolver role first.
              </p>
            )}
            {errors.adminUserId && (
              <p className="mt-1.5 text-sm text-red-600">{errors.adminUserId.message}</p>
            )}
          </div>

          <Input
            label="Employee ID (Optional)"
            placeholder="e.g., EMP-001"
            {...register('employeeId')}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Specializations
            </label>
            <div className="flex flex-wrap gap-2">
              {specializationOptions.map((spec) => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => toggleSpecialization(spec)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedSpecializations.includes(spec)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
            {errors.specializations && (
              <p className="mt-1.5 text-sm text-red-600">{errors.specializations.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Status
            </label>
            <select
              {...register('status')}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
            >
              <option value="active">Active</option>
              <option value="busy">Busy</option>
              <option value="unavailable">Unavailable</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending}
              disabled={availableUsers.length === 0}
            >
              Create Resolver
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!viewingResolver}
        onClose={() => setViewingResolver(null)}
        title="Resolver Details"
        size="lg"
      >
        {viewingResolver && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {getAdminUser(viewingResolver.adminUserId)?.name?.charAt(0)?.toUpperCase() || 'R'}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {getAdminUser(viewingResolver.adminUserId)?.name || 'Unknown'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {getAdminUser(viewingResolver.adminUserId)?.email}
                </p>
                {viewingResolver.employeeId && (
                  <p className="text-sm text-gray-400 dark:text-gray-500">ID: {viewingResolver.employeeId}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                  <TrendingUp className="h-4 w-4" />
                  Current Load
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {viewingResolver.currentLoad} issues
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Total Resolved
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {viewingResolver.totalResolved}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                  <Star className="h-4 w-4" />
                  Rating
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {viewingResolver.rating.toFixed(1)} / 5.0
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                  <Clock className="h-4 w-4" />
                  On-Time Delivery
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {viewingResolver.onTimeDelivery}%
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Specializations</h4>
              <div className="flex flex-wrap gap-2">
                {viewingResolver.specializations.map((spec) => (
                  <Badge key={spec} variant="primary">
                    {spec}
                  </Badge>
                ))}
              </div>
            </div>

            {viewingResolver.avgResolutionTime && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Average Resolution Time
                </h4>
                <p className="text-gray-900 dark:text-white">
                  {Math.round(viewingResolver.avgResolutionTime / 60)} hours
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setViewingResolver(null)}>
                Close
              </Button>
              <select
                value={viewingResolver.status}
                onChange={(e) => {
                  updateMutation.mutate({
                    id: viewingResolver.id,
                    data: { status: e.target.value },
                  });
                  setViewingResolver({ ...viewingResolver, status: e.target.value });
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:bg-gray-800 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="busy">Busy</option>
                <option value="unavailable">Unavailable</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
};

export default ResolversPage;
