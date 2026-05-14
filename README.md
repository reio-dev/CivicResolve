# CivicResolv

A mobile-first civic issue reporting platform that empowers citizens to report, validate, and track infrastructure problems in their community.

## Features

### For Citizens
- **Photo-Based Reporting**: Capture issues with your camera, automatically geo-tagged
- **Real-Time Tracking**: Follow your reported issues from submission to resolution
- **Community Validation**: Vote on issue validity to prioritize genuine concerns
- **Gamification**: Earn points, badges, and climb leaderboards for civic participation
- **Comments & Updates**: Engage with other citizens and receive government responses

### For Government/Administrators
- **Web Dashboard**: Comprehensive admin panel for issue management
- **Department Management**: Organize teams by specialty (Roads, Water, Electrical, etc.)
- **Resolver Assignment**: Assign field workers to issues based on location and expertise
- **Analytics**: Track resolution times, department performance, and citizen engagement
- **SLA Monitoring**: Set and monitor service level agreements per department

## Issue Categories

| Category | Description |  
|----------|-------------|
| Roads | Potholes, road damage, traffic signs, speed breakers |
| Electrical | Street lights, electrical hazards, power outages |
| Water | Leaks, supply issues, pipeline problems, water quality |
| Drainage | Blocked drains, sewage, flooding, manholes |
| Sanitation | Garbage, waste dumps, cleanliness, public toilets |
| Public Safety | Unsafe areas, missing railings, abandoned vehicles, stray animals |

## Technology Stack

### Frontend (Mobile App)
- React Native with Expo SDK 54
- React Navigation v7
- TanStack React Query
- React Native Reanimated

### Backend
- Node.js with Express
- PostgreSQL with Drizzle ORM
- RESTful API architecture

### Admin Dashboard
- React with Vite
- Tailwind CSS
- Recharts for analytics

## Project Structure

```
civicresolv/
├── client/                 # React Native mobile app
│   ├── components/         # Reusable UI components
│   ├── screens/            # App screens
│   ├── navigation/         # Navigation configuration
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Utilities and API client
├── server/                 # Express backend
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API route registration
│   ├── admin-routes.ts     # Admin API endpoints
│   ├── storage.ts          # Database operations
│   └── db.ts               # Database connection
├── admin/                  # Web admin dashboard
│   └── src/
│       ├── components/     # Dashboard UI components
│       ├── pages/          # Dashboard pages
│       └── hooks/          # Dashboard hooks
├── shared/                 # Shared code
│   └── schema.ts           # Database schema (Drizzle)
└── assets/                 # Static assets
```

## User Roles

| Role | Access |
|------|--------|
| Citizen | Mobile app - report issues, validate, comment |
| Resolver | Mobile app - view assigned issues, update status, upload resolution photos |
| Department Admin | Web dashboard - manage department issues and resolvers |
| Super Admin | Web dashboard - full access to all departments and settings |

## API Endpoints

### Public API
- `POST /api/auth/register` - Register new citizen
- `POST /api/auth/login` - Citizen login
- `GET /api/issues` - List issues (with filters)
- `POST /api/issues` - Create new issue
- `POST /api/issues/:id/validate` - Vote on issue validity
- `GET /api/leaderboard` - Get top contributors

### Admin API
- `POST /api/admin/auth/login` - Admin login
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/departments` - List departments
- `GET /api/admin/issues` - List all issues
- `POST /api/admin/issues/:id/assign` - Assign resolver to issue

## Screenshots

*Coming soon*

## License

MIT License

## Contributing

Contributions are welcome! Please read the setup guide before submitting pull requests.
