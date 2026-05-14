# CivicResolv - Setup Guide

Complete setup instructions for running CivicResolv on your local machine.

## Prerequisites

- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **PostgreSQL** 14.x or higher
- **Expo Go** app on your mobile device (optional, for testing on physical device)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd civicresolv
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install Admin Dashboard Dependencies

```bash
cd admin
npm install
cd ..
```

## Database Setup

### Windows

**Option A: Using pgAdmin (Recommended)**
1. Open pgAdmin
2. Right-click "Databases" → "Create" → "Database"
3. Enter name: `civicresolv`
4. Click "Save"

**Option B: Using SQL Shell (psql)**
1. Open "SQL Shell (psql)" from Start Menu
2. Press Enter for defaults, enter your password
3. Run:
```sql
CREATE DATABASE civicresolv;
\q
```

**Set Environment Variable:**

Command Prompt:
```cmd
set DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/civicresolv
```

PowerShell:
```powershell
$env:DATABASE_URL = "postgresql://postgres:yourpassword@localhost:5432/civicresolv"
```

### macOS / Linux

```bash
# Create database
createdb civicresolv

# Or using psql
psql -U postgres -c "CREATE DATABASE civicresolv;"

# Set environment variable
export DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/civicresolv"
```

### Push Database Schema

This creates all tables and seeds default data:

```bash
npm run db:push
```

The seeding process will create:
- 1 Super Admin account
- 6 Departments (Road, Electrical, Water, Drainage, Sanitation, Public Safety)
- 6 Department Admin accounts
- 6 Resolver accounts

## Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/civicresolv

# Expo/Mobile App
EXPO_PUBLIC_DOMAIN=localhost:5000

# Server (optional)
PORT=5000
NODE_ENV=development
```

## Building the Admin Dashboard

Before running the server, build the admin dashboard:

```bash
cd admin
npm run build
cd ..
```

## Running the Application

### Option A: Both Servers Together

**Windows (Command Prompt):**
```cmd
set EXPO_PUBLIC_DOMAIN=localhost:5000
npm run all:dev
```

**Windows (PowerShell):**
```powershell
$env:EXPO_PUBLIC_DOMAIN = "localhost:5000"
npm run all:dev
```

**macOS / Linux:**
```bash
EXPO_PUBLIC_DOMAIN=localhost:5000 npm run all:dev
```

### Option B: Servers Separately (Recommended for Debugging)

**Terminal 1 - Backend Server:**
```bash
npm run server:dev
```

**Terminal 2 - Expo Development Server:**

Windows (CMD):
```cmd
set EXPO_PUBLIC_DOMAIN=localhost:5000
npx expo start --localhost
```

macOS/Linux:
```bash
EXPO_PUBLIC_DOMAIN=localhost:5000 npx expo start --localhost
```

## Accessing the Application

| Platform | URL |
|----------|-----|
| Mobile Web App | http://localhost:8081 |
| Admin Dashboard | http://localhost:5000/admin |
| API Endpoints | http://localhost:5000/api/* |
| iOS/Android | Scan QR code in terminal with Expo Go |

## Default Login Credentials

  ### Admin Dashboard (http://localhost:5000/admin)

**Super Admin:**
- Username: `superadmin`
- Password: `superadmin123`

**Department Admins:**
| Username | Password |
|----------|----------|
| admin_road | roadadmin123 |
| admin_electrical | electricaladmin123 |
| admin_water | wateradmin123 |
| admin_drainage | drainageadmin123 |
| admin_sanitation | sanitationadmin123 |
| admin_public_safety | public_safetyadmin123 |

**Department Resolvers:**
| Username | Password |
|----------|----------|
| resolver_road | roadresolver123 |
| resolver_electrical | electricalresolver123 |
| resolver_water | waterresolver123 |
| resolver_drainage | drainageresolver123 |
| resolver_sanitation | sanitationresolver123 |
| resolver_public_safety | public_safetyresolver123 |

### Mobile App

Register a new account through the app, or use seeded resolver accounts.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run all:dev` | Start both Expo and Express servers |
| `npm run server:dev` | Start Express server only |
| `npm run expo:dev` | Start Expo server only |
| `npm run db:push` | Push schema changes to database |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `cd admin && npm run build` | Build admin dashboard |
| `cd admin && npm run dev` | Run admin dashboard in dev mode |

## Troubleshooting

### Database Connection Failed
- Ensure PostgreSQL is running
- Verify `DATABASE_URL` is correct
- Check that the database `civicresolv` exists

### "relation does not exist" Error
Run the schema push:
```bash
npm run db:push
```

### Camera/Location Not Working on Web
- These features require a physical device
- Use Expo Go app on iOS/Android for full functionality

### API Connection Errors in Mobile App
- Ensure `EXPO_PUBLIC_DOMAIN` matches your server address
- For physical devices on same network, use your computer's local IP:
  ```
  EXPO_PUBLIC_DOMAIN=192.168.1.100:5000
  ```

### Metro Bundler Issues
Clear cache and restart:
```bash
npx expo start --clear
```

### Port Already in Use
- Backend uses port 5000
- Expo uses port 8081
- Kill existing processes or change ports

### Admin Dashboard Not Loading
Ensure you built it:
```bash
cd admin && npm run build
```

## Development Notes

### Adding New Dependencies
- Use `npm install <package>` for backend/shared dependencies
- Use `cd admin && npm install <package>` for admin dashboard
- For Expo, only use Expo-compatible packages

### Database Schema Changes
1. Edit `shared/schema.ts`
2. Run `npm run db:push`
3. Restart the server

### API Changes
1. Edit `server/routes.ts` or `server/admin-routes.ts`
2. Server auto-restarts with tsx watch mode

## Production Deployment

For production deployment on Replit:
1. Build the admin dashboard
2. Build static Expo bundles
3. Use Replit's deployment (publishing) feature

For other platforms, ensure:
- `NODE_ENV=production`
- Database connection is configured
- Environment variables are set
- Admin dashboard is built
