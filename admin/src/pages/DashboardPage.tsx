import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Badge, { getStatusBadgeVariant } from '../components/Badge';
import { LoadingPage } from '../components/LoadingSpinner';
import { adminApi, DashboardStats } from '../lib/api';
import { formatDate, formatNumber, formatPercentage } from '../lib/utils';

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color }) => (
  <motion.div variants={itemVariants}>
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                {trend.isPositive ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={`text-sm font-medium ${
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {trend.value}%
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">vs last week</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const DashboardPage: React.FC = () => {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await adminApi.getDashboardStats();
      return response.data;
    },
  });

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  const categoryData = Object.entries(stats.issuesByCategory || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
    value,
  }));

  const statusData = Object.entries(stats.issuesByStatus || {}).map(([name, value]) => ({
    name: name.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    value,
  }));

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Issues"
          value={formatNumber(stats.totalIssues)}
          icon={<AlertCircle className="h-6 w-6 text-blue-600" />}
          trend={{ value: 12, isPositive: true }}
          color="bg-blue-50 dark:bg-blue-900/30"
        />
        <StatCard
          title="Pending Issues"
          value={formatNumber(stats.pendingIssues)}
          icon={<Clock className="h-6 w-6 text-yellow-600" />}
          trend={{ value: 5, isPositive: false }}
          color="bg-yellow-50 dark:bg-yellow-900/30"
        />
        <StatCard
          title="Resolution Rate"
          value={formatPercentage(stats.resolutionRate)}
          icon={<CheckCircle className="h-6 w-6 text-green-600" />}
          trend={{ value: 8, isPositive: true }}
          color="bg-green-50 dark:bg-green-900/30"
        />
        <StatCard
          title="Active Resolvers"
          value={stats.activeResolvers}
          icon={<Users className="h-6 w-6 text-purple-600" />}
          color="bg-purple-50 dark:bg-purple-900/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Issues Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.issuesTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString('en-US', { weekday: 'short' })
                      }
                      className="text-gray-500 dark:text-gray-400"
                      stroke="currentColor"
                      tick={{ fill: 'currentColor' }}
                    />
                    <YAxis 
                      className="text-gray-500 dark:text-gray-400"
                      stroke="currentColor"
                      tick={{ fill: 'currentColor' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--tooltip-bg, white)',
                        border: '1px solid var(--tooltip-border, #E5E7EB)',
                        borderRadius: '8px',
                        color: 'var(--tooltip-text, #374151)',
                      }}
                      wrapperClassName="[--tooltip-bg:white] [--tooltip-border:#E5E7EB] [--tooltip-text:#374151] dark:[--tooltip-bg:#1F2937] dark:[--tooltip-border:#374151] dark:[--tooltip-text:#F9FAFB]"
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#3B82F6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Issues by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis 
                      type="number" 
                      className="text-gray-500 dark:text-gray-400"
                      stroke="currentColor"
                      tick={{ fill: 'currentColor' }}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={80}
                      className="text-gray-500 dark:text-gray-400"
                      stroke="currentColor"
                      tick={{ fill: 'currentColor' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--tooltip-bg, white)',
                        border: '1px solid var(--tooltip-border, #E5E7EB)',
                        borderRadius: '8px',
                        color: 'var(--tooltip-text, #374151)',
                      }}
                      wrapperClassName="[--tooltip-bg:white] [--tooltip-border:#E5E7EB] [--tooltip-text:#374151] dark:[--tooltip-bg:#1F2937] dark:[--tooltip-border:#374151] dark:[--tooltip-text:#F9FAFB]"
                    />
                    <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Issues by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--tooltip-bg, white)',
                        border: '1px solid var(--tooltip-border, #E5E7EB)',
                        borderRadius: '8px',
                        color: 'var(--tooltip-text, #374151)',
                      }}
                      wrapperClassName="[--tooltip-bg:white] [--tooltip-border:#E5E7EB] [--tooltip-text:#374151] dark:[--tooltip-bg:#1F2937] dark:[--tooltip-border:#374151] dark:[--tooltip-text:#F9FAFB]"
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">{issue.title}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {issue.category} - {formatDate(issue.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusBadgeVariant(issue.status)}>
                        {issue.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default DashboardPage;
