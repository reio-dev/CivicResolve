import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Search, Gift } from 'lucide-react';
import { adminApi } from '../lib/api';
import { formatDate } from '../lib/utils';
import DataTable from '../components/DataTable';
import { Card, CardContent, CardHeader } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';

const addCreditsSchema = z.object({
  amount: z.coerce.number().min(1, 'Amount must be greater than 0'),
});

type AddCreditsFormData = z.infer<typeof addCreditsSchema>;

const CitizensPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['app-users'],
    queryFn: () => adminApi.getAppUsers().then(res => res.data),
  });

  const addCreditsMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      adminApi.addCredits(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-users'] });
      handleCloseModal();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddCreditsFormData>({
    resolver: zodResolver(addCreditsSchema),
    defaultValues: {
      amount: 100,
    },
  });

  const handleOpenModal = (user: any) => {
    setSelectedUser(user);
    reset({ amount: 100 });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    reset();
  };

  const onSubmit = (data: AddCreditsFormData) => {
    if (selectedUser) {
      addCreditsMutation.mutate({ id: selectedUser.id, amount: data.amount });
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const nameMatch = (user.displayName || user.username || '').toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch;
    });
  }, [users, searchQuery]);

  const columns = [
    {
      key: 'name',
      header: 'Citizen',
      render: (user: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            {(user.displayName || user.username || 'C').charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white block">
              {user.displayName || user.username}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Level / XP',
      render: (user: any) => (
        <div>
          <span className="text-gray-900 dark:text-gray-300 font-medium">Lvl {user.level || 1}</span>
          <span className="text-gray-500 dark:text-gray-400 text-xs block">{user.points || 0} XP</span>
        </div>
      ),
    },
    {
      key: 'credits',
      header: 'Credits',
      render: (user: any) => (
        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{user.credits || 0}</span>
      ),
    },
    {
      key: 'stats',
      header: 'Activity',
      render: (user: any) => (
        <div className="text-sm">
          <div className="text-gray-600 dark:text-gray-400">Reported: {user.issuesReported || 0}</div>
          <div className="text-gray-600 dark:text-gray-400">Resolved: {user.issuesResolved || 0}</div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (user: any) => formatDate(user.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(user);
            }}
            title="Add Credits"
            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors flex items-center gap-1"
          >
            <Gift className="h-4 w-4" />
            <span className="text-xs font-medium">Add Credits</span>
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Citizens</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage app users and allocate credits</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search citizens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200/50 dark:border-zinc-800/50 rounded-lg bg-white/50 dark:bg-black/40 backdrop-blur-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
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
            emptyMessage="No citizens found"
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Add Credits"
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg mb-4">
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              Allocating credits to <span className="font-bold">{selectedUser?.displayName || selectedUser?.username}</span>.
              Current balance: <span className="font-bold">{selectedUser?.credits || 0}</span>
            </p>
          </div>
          
          <Input
            label="Amount to Add"
            type="number"
            placeholder="e.g. 100"
            error={errors.amount?.message}
            {...register('amount')}
          />
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700"
              isLoading={addCreditsMutation.isPending}
            >
              Confirm
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};

export default CitizensPage;
