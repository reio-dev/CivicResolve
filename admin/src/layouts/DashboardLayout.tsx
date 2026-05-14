import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  AlertCircle,
  Users,
  Building2,
  UserCog,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Bell,
  Settings,
  Moon,
  Sun,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Issues', href: '/issues', icon: AlertCircle },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Departments', href: '/departments', icon: Building2 },
  { name: 'Resolvers', href: '/resolvers', icon: UserCog },
];

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('admin_dark_mode');
    return saved === 'true';
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    localStorage.setItem('admin_dark_mode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={cn("min-h-screen", darkMode ? "bg-gray-900" : "bg-gray-50")}>
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 72 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn("fixed left-0 top-0 z-40 h-screen border-r overflow-hidden", darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}
      >
        <div className={cn("flex h-16 items-center justify-between px-4 border-b", darkMode ? "border-gray-700" : "border-gray-100")}>
          <AnimatePresence mode="wait">
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
                <span className={cn("font-bold text-lg", darkMode ? "text-white" : "text-gray-900")}>CivicResolv</span>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn("p-2 rounded-lg transition-colors", darkMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500")}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <nav className="mt-4 px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? darkMode ? 'bg-gradient-to-r from-blue-900/50 to-purple-900/50 text-blue-400' : 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700'
                    : darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive && (darkMode ? 'text-blue-400' : 'text-blue-600'))} />
                <AnimatePresence mode="wait">
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="whitespace-nowrap"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>
      </motion.aside>

      <motion.div
        initial={false}
        animate={{ marginLeft: sidebarOpen ? 256 : 72 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="min-h-screen"
      >
        <header className={cn("sticky top-0 z-30 flex h-16 items-center justify-between border-b px-6", darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}>
          <div>
            <h1 className={cn("text-lg font-semibold", darkMode ? "text-white" : "text-gray-900")}>
              {navigation.find((n) => n.href === location.pathname)?.name || 'Admin Panel'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={cn("p-2 rounded-lg transition-colors", darkMode ? "text-yellow-400 hover:bg-gray-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100")}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button className={cn("p-2 rounded-lg transition-colors relative", darkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100")}>
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
            </button>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={cn("flex items-center gap-2 p-2 rounded-lg transition-colors", darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")}
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <span className={cn("text-sm font-medium hidden sm:block", darkMode ? "text-gray-300" : "text-gray-700")}>
                  {user?.name || 'Admin'}
                </span>
                <ChevronDown className={cn("h-4 w-4", darkMode ? "text-gray-400" : "text-gray-500")} />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className={cn("absolute right-0 mt-2 w-48 rounded-lg shadow-lg border py-1 z-50", darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}
                  >
                    <div className={cn("px-4 py-2 border-b", darkMode ? "border-gray-700" : "border-gray-100")}>
                      <p className={cn("text-sm font-medium", darkMode ? "text-white" : "text-gray-900")}>{user?.name}</p>
                      <p className={cn("text-xs", darkMode ? "text-gray-400" : "text-gray-500")}>@{user?.username}</p>
                    </div>
                    <button
                      onClick={() => {}}
                      className={cn("w-full flex items-center gap-2 px-4 py-2 text-sm", darkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-50")}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className={cn("w-full flex items-center gap-2 px-4 py-2 text-sm", darkMode ? "text-red-400 hover:bg-red-900/20" : "text-red-600 hover:bg-red-50")}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="p-6">
          <Outlet />
        </main>
      </motion.div>

      {userMenuOpen && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setUserMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
