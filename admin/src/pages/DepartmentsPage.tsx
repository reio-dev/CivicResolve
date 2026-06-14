import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Building2, X, Clock } from 'lucide-react';
import { adminApi, Department } from '../lib/api';
import { formatDate } from '../lib/utils';
import DataTable from '../components/DataTable';
import { Card, CardContent, CardHeader } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Select from '../components/Select';

const departmentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().optional(),
  categories: z.array(z.string()).min(1, 'At least one category is required'),
  color: z.string().min(1, 'Color is required'),
  icon: z.string().min(1, 'Icon is required'),
  slaHours: z.number().min(1, 'SLA hours must be at least 1'),
  isActive: z.boolean().default(true),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;

const categoryOptions = [
  'roads', 'water', 'waste', 'electricity', 'drainage', 'parks', 
  'streetlights', 'sewage', 'buildings', 'traffic', 'environment', 'other'
];

const colorOptions = [
  { value: '#3B82F6', label: 'Blue' },
  { value: '#10B981', label: 'Green' },
  { value: '#F59E0B', label: 'Orange' },
  { value: '#EF4444', label: 'Red' },
  { value: '#52525b', label: 'Zinc' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#84CC16', label: 'Lime' },
];

const iconOptions = [
  'building', 'road', 'droplet', 'trash', 'zap', 'tree', 'lamp', 'pipe', 'home', 'car'
];

const DepartmentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmDept, setDeleteConfirmDept] = useState<Department | null>(null);

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => adminApi.getDepartments().then(res => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: DepartmentFormData) => adminApi.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DepartmentFormData> }) =>
      adminApi.updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      handleCloseModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDeleteConfirmDept(null);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      categories: [],
      color: '#3B82F6',
      icon: 'building',
      slaHours: 48,
      isActive: true,
    },
  });

  const selectedCategories = watch('categories') || [];
  const selectedColor = watch('color');

  const handleOpenModal = (department?: Department) => {
    if (department) {
      setEditingDepartment(department);
      reset({
        name: department.name,
        slug: department.slug,
        description: department.description || '',
        categories: department.categories,
        color: department.color,
        icon: department.icon,
        slaHours: department.slaHours,
        isActive: department.isActive,
      });
    } else {
      setEditingDepartment(null);
      reset({
        name: '',
        slug: '',
        description: '',
        categories: [],
        color: '#3B82F6',
        icon: 'building',
        slaHours: 48,
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDepartment(null);
    reset();
  };

  const onSubmit = (data: DepartmentFormData) => {
    if (editingDepartment) {
      updateMutation.mutate({ id: editingDepartment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleCategory = (category: string) => {
    const current = selectedCategories;
    if (current.includes(category)) {
      setValue('categories', current.filter(c => c !== category));
    } else {
      setValue('categories', [...current, category]);
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const filteredDepartments = useMemo(() => {
    return departments.filter((dept) =>
      dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dept.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [departments, searchQuery]);

  const columns = [
    {
      key: 'name',
      header: 'Department',
      render: (dept: Department) => (
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${dept.color}20` }}
          >
            <Building2 className="h-5 w-5" style={{ color: dept.color }} />
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{dept.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{dept.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'categories',
      header: 'Categories',
      render: (dept: Department) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {dept.categories.slice(0, 3).map((cat) => (
            <Badge key={cat} size="sm" variant="default">
              {cat}
            </Badge>
          ))}
          {dept.categories.length > 3 && (
            <Badge size="sm" variant="default">
              +{dept.categories.length - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'slaHours',
      header: 'SLA Hours',
      render: (dept: Department) => (
        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
          <Clock className="h-4 w-4 text-gray-400" />
          <span>{dept.slaHours}h</span>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (dept: Department) => (
        <Badge variant={dept.isActive ? 'success' : 'default'}>
          {dept.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (dept: Department) => formatDate(dept.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (dept: Department) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(dept);
            }}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmDept(dept);
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Departments</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage government departments and their categories</p>
        </div>
        <Button onClick={() => handleOpenModal()} leftIcon={<Plus className="h-4 w-4" />}>
          Add Department
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200/50 dark:border-zinc-800/50 rounded-lg bg-white/50 dark:bg-black/40 backdrop-blur-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredDepartments}
            keyExtractor={(dept) => dept.id}
            isLoading={isLoading}
            emptyMessage="No departments found"
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingDepartment ? 'Edit Department' : 'Create Department'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Department Name"
            placeholder="e.g., Public Works"
            error={errors.name?.message}
            {...register('name', {
              onChange: (e) => {
                if (!editingDepartment) {
                  setValue('slug', generateSlug(e.target.value));
                }
              },
            })}
          />
          <Input
            label="Slug"
            placeholder="e.g., public-works"
            error={errors.slug?.message}
            helperText="Used in URLs and API references"
            {...register('slug')}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              {...register('description')}
              placeholder="Brief description of the department's responsibilities"
              rows={3}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedCategories.includes(category)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {category}
                  {selectedCategories.includes(category) && (
                    <X className="h-3 w-3 ml-1.5 inline" />
                  )}
                </button>
              ))}
            </div>
            {errors.categories && (
              <p className="mt-1.5 text-sm text-red-600">{errors.categories.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Department Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setValue('color', color.value)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    selectedColor === color.value
                      ? 'border-gray-900 dark:border-white scale-110'
                      : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
            {errors.color && (
              <p className="mt-1.5 text-sm text-red-600">{errors.color.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Icon
            </label>
            <Select
              {...register('icon')}
              options={iconOptions.map((icon) => ({
                value: icon,
                label: icon.charAt(0).toUpperCase() + icon.slice(1)
              }))}
              className="py-2.5"
            />
          </div>

          <Controller
            name="slaHours"
            control={control}
            render={({ field }) => (
              <Input
                label="SLA Hours"
                type="number"
                placeholder="48"
                error={errors.slaHours?.message}
                helperText="Maximum hours to resolve issues in this department"
                value={field.value}
                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
              />
            )}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              {...register('isActive')}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
              Department is active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingDepartment ? 'Update Department' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteConfirmDept}
        onClose={() => setDeleteConfirmDept(null)}
        title="Delete Department"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete{' '}
            <span className="font-semibold">{deleteConfirmDept?.name}</span>? This will
            affect all associated issues and resolvers.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteConfirmDept(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              isLoading={deleteMutation.isPending}
              onClick={() => deleteConfirmDept && deleteMutation.mutate(deleteConfirmDept.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};

export default DepartmentsPage;
