import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Filter } from 'lucide-react';
import { adminApi, AdminUser } from '../lib/api';
import { formatDate } from '../lib/utils';
import DataTable from '../components/DataTable';
import { Card, CardContent, CardHeader } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Select from '../components/Select';

const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  phone: z.string().optional(),
  role: z.enum(['super_admin', 'admin', 'resolver']),
  departmentId: z.string().optional(),
  status: z.string().default('active'),
});

type UserFormData = z.infer<typeof userSchema>;

const roleOptions = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'resolver', label: 'Resolver' },
];

const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getAdminUsers().then(res => res.data),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => adminApi.getDepartments().then(res => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: UserFormData & { password: string }) => adminApi.createAdminUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserFormData> }) =>
      adminApi.updateAdminUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      handleCloseModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteAdminUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteConfirmUser(null);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'admin',
      status: 'active',
    },
  });

  const selectedRole = watch('role');

  const handleOpenModal = (user?: AdminUser) => {
    if (user) {
      setEditingUser(user);
      reset({
        name: user.name,
        username: user.username,
        phone: user.phone || '',
        role: user.role,
        departmentId: user.departmentId || '',
        status: user.status,
      });
    } else {
      setEditingUser(null);
      reset({
        name: '',
        username: '',
        password: '',
        phone: '',
        role: 'admin',
        departmentId: '',
        status: 'active',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    reset();
  };

  const onSubmit = (data: UserFormData) => {
    if (editingUser) {
      const { password, ...updateData } = data;
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createMutation.mutate(data as UserFormData & { password: string });
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const getDepartmentName = (departmentId?: string) => {
    if (!departmentId) return '-';
    const dept = departments.find((d) => d.id === departmentId);
    return dept?.name || '-';
  };

  const getRoleBadgeVariant = (role: string) => {
    const variants: Record<string, 'primary' | 'secondary' | 'info'> = {
      super_admin: 'primary',
      admin: 'secondary',
      resolver: 'info',
    };
    return variants[role] || 'default';
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (user: AdminUser) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-gray-900 dark:text-white">{user.name}</span>
        </div>
      ),
    },
    {
      key: 'username',
      header: 'Username',
      render: (user: AdminUser) => (
        <span className="text-gray-600 dark:text-gray-400">@{user.username}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user: AdminUser) => (
        <Badge variant={getRoleBadgeVariant(user.role)}>
          {user.role.replace('_', ' ').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'departmentId',
      header: 'Department',
      render: (user: AdminUser) => (
        <span className="text-gray-900 dark:text-gray-300">{getDepartmentName(user.departmentId)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: AdminUser) => (
        <Badge variant={user.status === 'active' ? 'success' : 'default'}>
          {user.status}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (user: AdminUser) => formatDate(user.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user: AdminUser) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(user);
            }}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmUser(user);
            }}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage admin users and their permissions</p>
        </div>
        <Button onClick={() => handleOpenModal()} leftIcon={<Plus className="h-4 w-4" />}>
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200/50 dark:border-zinc-800/50 rounded-lg bg-white/50 dark:bg-black/40 backdrop-blur-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Roles' },
                  ...roleOptions
                ]}
                wrapperClassName="w-40"
                className="py-2 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredUsers}
            keyExtractor={(user) => user.id}
            isLoading={isLoading}
            emptyMessage="No users found"
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingUser ? 'Edit User' : 'Create User'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Enter full name"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Username"
            placeholder="Enter username"
            error={errors.username?.message}
            {...register('username')}
          />
          {!editingUser && (
            <Input
              label="Password"
              type="password"
              placeholder="Enter password"
              error={errors.password?.message}
              {...register('password')}
            />
          )}
          <Input
            label="Phone (Optional)"
            placeholder="Enter phone number"
            {...register('phone')}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Role
            </label>
            <Select
              {...register('role')}
              options={roleOptions}
              className="py-2.5"
            />
            {errors.role && (
              <p className="mt-1.5 text-sm text-red-600">{errors.role.message}</p>
            )}
          </div>
          {(selectedRole === 'resolver' || selectedRole === 'admin') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Department
              </label>
              <Select
                {...register('departmentId')}
                placeholder="Select Department"
                options={departments.map((dept) => ({
                  value: dept.id,
                  label: dept.name
                }))}
                className="py-2.5"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Status
            </label>
            <Select
              {...register('status')}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
              ]}
              className="py-2.5"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteConfirmUser}
        onClose={() => setDeleteConfirmUser(null)}
        title="Delete User"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete{' '}
            <span className="font-semibold">{deleteConfirmUser?.name}</span>? This
            action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteConfirmUser(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              isLoading={deleteMutation.isPending}
              onClick={() => deleteConfirmUser && deleteMutation.mutate(deleteConfirmUser.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};

export default UsersPage;
