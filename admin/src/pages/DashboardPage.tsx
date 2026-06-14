import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  AlertCircle, CheckCircle, Clock, Users, TrendingUp,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Badge, { getStatusBadgeVariant } from '../components/Badge';
import { LoadingPage } from '../components/LoadingSpinner';
import { adminApi, DashboardStats } from '../lib/api';
import { formatDate, formatNumber, formatPercentage, cn } from '../lib/utils';

const COLORS = ['#22c55e', '#3f3f46', '#16a34a', '#71717a', '#15803d', '#a1a1aa'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color }) => (
  <motion.div variants={itemVariants} className="w-full h-full">
    <Card className="h-full">
      <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-zinc-400">{title}</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 mt-1 sm:mt-2">
                {trend.isPositive ? (
                  <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                )}
                <span className={`text-xs sm:text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {trend.value}%
                </span>
              </div>
            )}
          </div>
          <div className={cn("p-2 sm:p-3 rounded-xl", color)}>{icon}</div>
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

  if (isLoading) return <LoadingPage />;
  if (!stats) return <div className="flex items-center justify-center h-64"><p className="text-gray-500 dark:text-gray-400">No data available</p></div>;

  const categoryData = Object.entries(stats.issuesByCategory || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
    value,
  }));

  const statusData = Object.entries(stats.issuesByStatus || {}).map(([name, value]) => ({
    name: name.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    value,
  }));

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Issues"
          value={formatNumber(stats.totalIssues)}
          icon={<AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700 dark:text-gray-300" />}
          trend={{ value: 12, isPositive: true }}
          color="bg-gray-100 dark:bg-zinc-900/50"
        />
        <StatCard
          title="Pending Issues"
          value={formatNumber(stats.pendingIssues)}
          icon={<Clock className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700 dark:text-gray-300" />}
          trend={{ value: 5, isPositive: false }}
          color="bg-gray-100 dark:bg-zinc-900/50"
        />
        <StatCard
          title="Resolution Rate"
          value={formatPercentage(stats.resolutionRate)}
          icon={<CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-500" />}
          trend={{ value: 8, isPositive: true }}
          color="bg-green-50 dark:bg-green-950/30"
        />
        <StatCard
          title="Active Resolvers"
          value={stats.activeResolvers}
          icon={<Users className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700 dark:text-gray-300" />}
          color="bg-gray-100 dark:bg-zinc-900/50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-500" />
                Issues Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.issuesTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-zinc-800" />
                    <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })} className="text-gray-500 dark:text-zinc-400" stroke="currentColor" />
                    <YAxis className="text-gray-500 dark:text-zinc-400" stroke="currentColor" />
                    <RechartsTooltip wrapperClassName="dark:bg-zinc-900 dark:border-zinc-800" />
                    <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader><CardTitle>Issues by Category</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-zinc-800" />
                    <XAxis type="number" className="text-gray-500 dark:text-zinc-400" stroke="currentColor" />
                    <YAxis dataKey="name" type="category" width={80} className="text-gray-500 dark:text-zinc-400" stroke="currentColor" />
                    <RechartsTooltip wrapperClassName="dark:bg-zinc-900 dark:border-zinc-800" />
                    <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} />
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
            <CardHeader><CardTitle>Issues by Status</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                      {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip wrapperClassName="dark:bg-zinc-900 dark:border-zinc-800" />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Recent Issues</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentIssues.map((issue) => {
                  const audioUrl = issue.images?.find((img) => img.includes('data:audio') || img.endsWith('.m4a') || img.endsWith('.mp3'));
                  return (
                    <div key={issue.id} className="flex flex-col p-4 bg-white/50 dark:bg-black/40 backdrop-blur-md rounded-lg hover:bg-white/80 dark:hover:bg-black/60 transition-colors cursor-pointer gap-2 border border-gray-200/50 dark:border-zinc-800/50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">{issue.title}</h4>
                          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{issue.category} - {formatDate(issue.createdAt)}</p>
                          {issue.assignments?.[0]?.resolver?.adminUser && (
                            <p className="text-xs text-green-600 dark:text-green-500 mt-1 font-medium">
                              Assigned to: {issue.assignments[0].resolver.adminUser.name}
                            </p>
                          )}
                        </div>
                        <Badge variant={getStatusBadgeVariant(issue.status)}>{issue.status.replace('_', ' ')}</Badge>
                      </div>
                      {audioUrl && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-zinc-800">
                          <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Voice Entry</p>
                          <audio controls src={audioUrl} className="h-8 w-full max-w-[300px]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default DashboardPage;
