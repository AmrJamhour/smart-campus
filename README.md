# Smart Campus Navigation System
### An-Najah National University — Faculty of Engineering
**Graduation Project | Computer Engineering | 2026**

---

## Project Overview
A full-stack platform that provides interactive campus navigation, academic scheduling, and real-time notifications for An-Najah National University students and staff.

| Component | Technology |
|-----------|-----------|
| Backend   | Node.js + Express + PostgreSQL |
| Web App   | React.js |
| Mobile    | React Native (Expo) |
| Push Notifications | Firebase Cloud Messaging |
| Authentication | JWT (access + refresh tokens) |

---

## Prerequisites
- Node.js v18+
- PostgreSQL 14+
- npm v9+
- Expo CLI (for mobile): `npm install -g expo-cli`
- (Optional) Expo Go app on your phone

---

## 1. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE smart_campus;"

# Run schema
psql -U postgres -d smart_campus -f backend/database/schema.sql

# Run seed data (buildings, floors, demo admin)
psql -U postgres -d smart_campus -f backend/database/seed.sql
```

---

## 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env — fill in:
#   DB_PASSWORD=your_postgres_password
#   JWT_SECRET=any_long_random_string
#   JWT_REFRESH_SECRET=another_long_random_string
#   (Firebase keys optional — only needed for push notifications)

# Start development server
npm run dev
```

Server runs at: **http://localhost:5000**
Health check: **http://localhost:5000/api/health**

---

## 3. Web App Setup

```bash
cd web

# Install dependencies
npm install

# Start development server
npm start
```

Web app runs at: **http://localhost:3000**

### Default Admin Account
After running seed.sql:
- Email: `admin@najah.edu`
- Password: `Admin@1234`

---

## 4. Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install

# For Android emulator (change API URL in src/api/index.js):
# BASE_URL = 'http://10.0.2.2:5000/api'   ← Android emulator
# BASE_URL = 'http://YOUR_IP:5000/api'     ← Physical device

# Start Expo
npx expo start
```

- Scan the QR code with **Expo Go** (Android/iOS)
- Or press `a` for Android emulator, `i` for iOS simulator

---

## 5. First-Time Admin Setup

1. Log in at http://localhost:3000 with `admin@najah.edu`
2. Go to **Admin → Floors & Maps**
3. Select a building, then click **Upload Map** on a floor to upload your AutoCAD-exported PNG/SVG
4. Go to **Admin → Map Editor** to place rooms on the uploaded map
5. Use **🔗 Connect mode** to draw pathfinding connections between rooms
6. Click **💾 Save Layout**
7. Go to **Admin → Schedule** to add course sections and assign rooms

---

## Project Structure

```
smart-campus/
├── backend/                   Node.js API
│   ├── config/                db.js · multer.js · firebase.js
│   ├── controllers/           auth · users · floors · rooms · schedule
│   │                          search · notifications · announcements
│   │                          courses · instructors · mapEditor
│   ├── middleware/            auth.js · errorHandler.js · validate.js
│   ├── models/                (schema in database/schema.sql)
│   ├── routes/                one file per resource
│   ├── utils/                 jwt.js
│   ├── database/              schema.sql · seed.sql · migrate.js
│   ├── tests/                 auth.test.js
│   ├── uploads/               map images · avatars · announcements
│   ├── server.js
│   └── API_DOCS.md
│
├── web/                       React web app
│   ├── src/
│   │   ├── api/               axiosInstance · authAPI · floorAPI · index
│   │   ├── context/           AuthContext
│   │   ├── hooks/             useFloors · useRooms · useSchedule · etc.
│   │   ├── components/
│   │   │   ├── layout/        Navbar · Sidebar
│   │   │   └── ui/            Button · Input · Modal · Table · etc.
│   │   ├── pages/
│   │   │   ├── AuthPages      Login · Register
│   │   │   ├── DashboardPage
│   │   │   ├── MapPage        Interactive map with pathfinding
│   │   │   ├── SchedulePage   Week view + list view
│   │   │   ├── SearchAndNotifications
│   │   │   ├── ProfileAndAnnouncements
│   │   │   └── admin/
│   │   │       ├── AdminPages     Dashboard · Users · Floors · Schedule · Notifications
│   │   │       ├── MapEditorPage  Drag-and-drop room editor ⭐
│   │   │       ├── AdminRoomsPage
│   │   │       └── AdminAnnouncementsPage
│   │   ├── styles/            variables.css · global.css
│   │   └── utils/             dijkstra.js · helpers.js
│   └── public/
│
└── mobile/                    React Native (Expo)
    ├── src/
    │   ├── api/               index.js (all API calls)
    │   ├── context/           AuthContext
    │   ├── navigation/        RootNavigator (tabs + auth stack)
    │   ├── screens/
    │   │   ├── auth/          LoginScreen · RegisterScreen
    │   │   ├── MapScreen      SVG map with pan/zoom/pathfinding
    │   │   └── ScheduleScreen · SearchScreen · NotifScreen · ProfileScreen
    │   ├── utils/             dijkstra.js · helpers.js
    │   └── theme.js
    └── App.jsx
```

---

## Key Features

### For Students
- 🗺️ **Interactive campus map** — tap rooms to see details and schedule
- 📅 **My schedule** — week view + list view with room navigation
- 🔍 **Smart search** — rooms, courses, instructors
- ↗️ **Pathfinding** — shortest path between any two rooms (Dijkstra)
- 🔔 **Push notifications** — schedule changes, announcements
- 📢 **Announcements** — pinned posts from administration

### For Admins
- 🏢 **Floors manager** — create floors, upload map images (PNG/SVG/JPG)
- 🗺️ **Visual map editor** — drag rooms onto the map, resize, connect for pathfinding
- 📅 **Schedule manager** — create sections, assign rooms, detect conflicts
- 👥 **User management** — view, edit role/status, suspend students
- 📢 **Notifications** — broadcast push notifications to all/specific users
- 📝 **Announcements** — create, pin, publish with images

---

## Algorithms Used

### 1. Dijkstra's Shortest Path
Used for campus navigation — finds the shortest walkable route between any two rooms.
- Location: `web/src/utils/dijkstra.js` and `mobile/src/utils/dijkstra.js`
- Graph data loaded from: `GET /api/search/graph?floor_id=...`
- Edge weights stored in `room_adjacency` table (default: 1.0 per hop)

### 2. Full-text Search (PostgreSQL)
Room and course search uses `pg_trgm` + `to_tsvector` for fuzzy matching.
- Location: `backend/controllers/searchController.js`

### 3. Schedule Conflict Detection
When creating a section, the backend checks for room booking conflicts:
```sql
NOT (end_time <= $start OR start_time >= $end)
AND day_of_week && $days::int[]
```
- Location: `backend/controllers/scheduleController.js → createSection`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | No | API port (default 5000) |
| DB_HOST | Yes | PostgreSQL host |
| DB_PORT | Yes | PostgreSQL port |
| DB_NAME | Yes | Database name |
| DB_USER | Yes | Database user |
| DB_PASSWORD | Yes | Database password |
| JWT_SECRET | Yes | Access token secret (min 32 chars) |
| JWT_REFRESH_SECRET | Yes | Refresh token secret |
| JWT_EXPIRES_IN | No | Access token TTL (default 7d) |
| JWT_REFRESH_EXPIRES_IN | No | Refresh TTL (default 30d) |
| FIREBASE_PROJECT_ID | Optional | Firebase project ID |
| FIREBASE_PRIVATE_KEY | Optional | Firebase private key |
| FIREBASE_CLIENT_EMAIL | Optional | Firebase service account email |
| UPLOAD_PATH | No | Upload directory (default ./uploads) |
| MAX_FILE_SIZE_MB | No | Max upload size in MB (default 10) |
| ALLOWED_ORIGINS | No | CORS origins (comma-separated) |

---

## Testing

```bash
cd backend
npm install --save-dev jest supertest
npm test
```

---

## Group Members

| Name | ID |
|------|----|
| Amr Sami Salah Jamhour | — |
| Ihab Ghassan Ayash Habash | — |

**Supervisor:** Dr. Abdullah Rashid
**Department:** Computer Engineering
**Academic Year:** 2025/2026
"# smart-campus" 
"# smart-campus" 
