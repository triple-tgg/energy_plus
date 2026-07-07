# EnergyPlus API Design Document

> **Version**: 1.2  
> **Date**: February 22, 2026 (แก้ให้ตรงโค้ดจริง: 4 ก.ค. 2026)  
> **Database**: PostgreSQL (**Railway** Managed — db `railway`) + Redis (Railway)  
> **Existing Frontend**: ASP.NET MVC (C#) — hosted at `energyplus.kegroup.co.th:5500`  
> **New Backend**: Node.js + Express + TypeScript (`backend/`)

> ⚠️ **หมายเหตุความตรงกับโค้ด:** เอกสารนี้เป็น *design intent* บางส่วนต่างจาก implementation จริง — ยึด [project_documentation.md](project_documentation.md) เป็น source of truth. จุดที่ต่าง: (1) DB ย้ายจาก DigitalOcean → **Railway**, driver = `pg` ล้วน (ไม่ใช้ Knex/mysql2); (2) realtime ใช้ **Redis pub/sub + PostgreSQL LATERAL** แทน Socket.IO; (3) validation = **zod**; (4) aggregation job ใช้ 15-minute snapshot + daily/monthly snapshot + retention cleanup; (5) endpoint มิเตอร์ย่อยเป็น nested (`/meters/types/list`, `/meters/brands/list`, `/meters/loops/list`); (6) JWT = **HS256** access 24h / refresh 7d; (7) port backend **3003**, frontend **5175**.

---

## 📋 Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Configuration](#2-database-configuration)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema Summary](#4-database-schema-summary)
5. [API Modules & Endpoints](#5-api-modules--endpoints)
   - [5.1 Authentication](#51-authentication)
   - [5.2 Company Management](#52-company-management)
   - [5.3 Site & Location Hierarchy](#53-site--location-hierarchy)
   - [5.4 Meter Management](#54-meter-management)
   - [5.5 Meter Data & Monitoring](#55-meter-data--monitoring)
   - [5.6 Alarm System](#56-alarm-system)
   - [5.7 Demand Peak & Energy Saving](#57-demand-peak--energy-saving)
   - [5.8 Billing & Usage](#58-billing--usage)
   - [5.9 Layout & Floor Plans](#59-layout--floor-plans)
   - [5.10 Dashboard & Analytics](#510-dashboard--analytics)
   - [5.11 Reports & Export](#511-reports--export)
   - [5.12 User & Permission Management](#512-user--permission-management)
   - [5.13 Redis Pub/Sub (Realtime Transport)](#413-redis-pubsub-realtime-transport)
6. [Data Models](#6-data-models)
7. [Error Handling](#7-error-handling)
8. [Security](#8-security)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Web App     │  │  Mobile App  │  │  IoT Data Collector    │ │
│  │  (React/Vue) │  │  (Flutter)   │  │  (Modbus → API Push)   │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬───────────┘ │
└─────────┼─────────────────┼───────────────────────┼─────────────┘
          │                 │                       │
          ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY / PROXY                        │
│                    (Nginx / Traefik / Kong)                      │
│               Rate Limiting · CORS · SSL Termination             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Node.js + Express                       │   │
│  │                                                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐│   │
│  │  │   Auth   │ │  Meter   │ │  Alarm   │ │  Dashboard   ││   │
│  │  │  Module  │ │  Module  │ │  Module  │ │   Module     ││   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘│   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐│   │
│  │  │  Site    │ │ Billing  │ │  Layout  │ │   Report     ││   │
│  │  │  Module  │ │  Module  │ │  Module  │ │   Module     ││   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐    │
│  │  Middleware   │  │   Services    │  │    Utilities      │    │
│  │  • JWT Auth   │  │  • WebSocket  │  │  • Logger         │    │
│  │  • Validator  │  │  • Scheduler  │  │  • Date/Timezone  │    │
│  │  • Rate Limit │  │  • Telegram   │  │  • CSV/Excel Gen  │    │
│  └───────────────┘  └───────────────┘  └───────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │      PostgreSQL (Railway Managed)             │                │
│  │         Database: railway                    │                │
│  │         Host: zephyr.proxy.rlwy.net          │                │
│  │         Port: 23594 (SSL)                    │                │
│  │                                              │                │
│  │  Core:     meter, actual_meter_data,         │                │
│  │            actual_meter_data_daily,           │                │
│  │            actual_meter_data_monthly          │                │
│  │  Hierarchy: sites, buildings, zones           │                │
│  │  Config:   alarm_config, billing_config,      │                │
│  │            demand_peak_config                 │                │
│  │  Users:    app_user, group_user,              │                │
│  │            aspnetusers, user_permission        │                │
│  │  Layout:   layouts, layout_position,          │                │
│  │            layout_meter_config                │                │
│  └─────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Configuration

### Connection Details

| Parameter | Value |
|-----------|-------|
| **Provider** | **Railway** Managed PostgreSQL |
| **Host** | `zephyr.proxy.rlwy.net` (`DB_HOST`) |
| **Port** | `23594` (`DB_PORT`) |
| **Database** | `railway` (`DB_DATABASE`) |
| **User** | `postgres` (`DB_USER`) |
| **Password** | `<SET_IN_ENV>` |
| **SSL** | Required (`rejectUnauthorized: false`) |

> เดิมใช้ DigitalOcean (`...sgp1-56999...:25060`, db `energy_plus`, user `energyadmin`) — ย้ายมา Railway แล้ว ค่าจริงอยู่ใน `.env`

### Redis (Railway) — Realtime Pub/Sub

| Parameter | Value |
|-----------|-------|
| **Host** | `ballast.proxy.rlwy.net` (`REDIS_HOST`) |
| **Port** | `13915` (`REDIS_PORT`) |
| **Enabled** | `REDIS_ENABLED=true` |
| **Default Channel** | `project1_1000_1` (`REDIS_DEFAULT_CHANNEL`) |

### Environment Variables (`.env`)

```bash
# Server Configuration
NODE_ENV=development
PORT=3003

# Database Configuration (Railway PostgreSQL)
DB_HOST=zephyr.proxy.rlwy.net
DB_PORT=23594
DB_DATABASE=railway
DB_USER=postgres
DB_PASSWORD=<your_db_password>
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:5175

# Redis Configuration (Railway)
REDIS_ENABLED=true
REDIS_HOST=ballast.proxy.rlwy.net
REDIS_PORT=13915
REDIS_PASSWORD=<your_redis_password>
REDIS_DEFAULT_CHANNEL=project1_1000_1
REDIS_AUTO_SUBSCRIBE=false

# Logging
LOG_LEVEL=debug
```

### Connection Pool Configuration (`src/config/database.ts`)

```typescript
import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'zephyr.proxy.rlwy.net',
  database: process.env.DB_DATABASE || 'railway',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '23594', 10),
  max: 20,                        // Max connections in pool
  idleTimeoutMillis: 30000,       // Close idle connections after 30s
  connectionTimeoutMillis: 2000,  // Fail if can't connect in 2s
  ssl: { rejectUnauthorized: false },  // Required for Railway managed PostgreSQL
};

const pool = new Pool(poolConfig);
```

### Connection String (URI Format)

```
postgresql://postgres:<your_db_password>@zephyr.proxy.rlwy.net:23594/railway?sslmode=require
```

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Node.js 20 LTS | Event-driven, ideal for real-time meter data |
| **Framework** | Express.js + TypeScript | Lightweight, type-safe, mature ecosystem |
| **Database Driver** | pg (node-postgres) | Native PostgreSQL driver with pool management |
| **Query Layer** | Raw SQL + `pg` | Direct PostgreSQL queries without ORM |
| **Authentication** | JWT (jsonwebtoken) | Stateless auth, compatible with existing ASP.NET Identity |
| **Validation** | Zod | Schema-based request validation |
| **Real-time** | Redis pub/sub + PostgreSQL LATERAL | Realtime monitoring without Socket.IO |
| **Scheduler** | node-cron | 15-minute / daily / monthly / retention jobs |
| **Notifications** | node-telegram-bot-api | Existing Telegram alarm integration |
| **Documentation** | Swagger / OpenAPI 3.0 | Auto-generated API docs |
| **Logging** | Winston | Structured logging with file rotation |

---

## 3. Database Schema Summary

### Entity Relationship Overview

```
company (1) ─────────────────────────────────────────────────────
                                                                  
sites (1) ──┬── buildings (N) ──┬── zones (N) ──── meter (N)    
             │                   │                    │            
             │                   │                    ├── meter_data_realtime (N)
             │                   │                    ├── actual_meter_data (N)
             │                   │                    ├── actual_meter_data_daily (N)
             │                   │                    ├── actual_meter_data_monthly (N)
             │                   │                    ├── alarm_config (N)
             │                   │                    ├── realtime_meter_map (N)
             │                   │                    └── meter.parent_meter_id (self-ref)
             │                   │                                 
             └── site_user_map (N) ── app_user (1)               
                                        │                         
                                        └── group_user (1)       
                                              │                   
                                              └── user_permission (N)
                                                                  
meter_brand (1) ──── meter (N)                                   
meter_type  (1) ──── meter (N)                                   
loop        (1) ──── meter (N)                                   
energy_value (1) ──── alarm_config (N)                           
                                                                  
layouts (1) ──── layout_points (N)                               
                                                                  
demand_peak_config (1) ──── demand_meter_config (N)              
                       ──── demand_peak_data (N)                 
                                                                  
alarm_group (1) ──── alarm_group_mapping (N)                     
aggregation_job_runs (aggregation job audit)                     
billing_config                                                    
energy_daily_usage                                                
energy_save                                                       
saving_meter_config                                               
```
> หมายเหตุ: ตาราง `layout_position` / `layout_meter_config` / `child_meter` / `aspnetusers` ที่เคยระบุไว้ **ไม่มีจริง** ใน DB นี้ — layout points ใช้ตาราง `layout_points`, child meter ใช้ self-ref `meter.parent_meter_id`

### Key Tables by Domain

Records = จำนวนแถวจริงใน DB ณ `2026-07-07` (ดูรายละเอียดเต็มใน `DATABASE_TABLE_SUMMARY.md`)

| Domain | Tables | Records |
|--------|--------|---------|
| **Infrastructure** | `sites`, `buildings`, `zones` | 7, 12, 32 |
| **Meters** | `meter`, `meter_brand`, `meter_type`, `loop`, `protocol` | 4 (active), 19, 4, 16, 6 |
| **Realtime** | `meter_data_realtime`, `realtime_meter_map`, `aggregation_job_runs` | 355, 8, 2,943 |
| **Meter Data** | `actual_meter_data`, `actual_meter_data_daily`, `actual_meter_data_monthly` | 0, 0, 0 (truncated `2026-07-07`) |
| **Energy** | `energy_value`, `energy_daily_usage`, `energy_save` | 42, 0, 0 |
| **Alarms** | `alarm_config`, `alarm_group`, `alarm_group_mapping` | 0, 6, 0 |
| **Demand** | `demand_peak_config`, `demand_meter_config`, `demand_peak_data` | 4, 0, 0 |
| **Billing** | `billing_config` | 8 |
| **Users** | `app_user`, `group_user`, `user_permission`, `site_user_map` | 5, 12, 20, 13 |
| **Layouts** | `layouts`, `layout_points` | 6, 4 |
| **Company** | `company` | 2 |
| **Audit** | `auditlogs`, `write_log` | 0, 0 |

---

## 4. API Modules & Endpoints

**Base URL**: `https://api.energyplus.kegroup.co.th/api/v1`

> **Implementation status** (sync กับ `backend/src` ณ `2026-07-07`):
> - **Status** column: ✅ = implemented ในโค้ดจริง, 🔲 = planned (ยังไม่มีใน route)
> - `Endpoint` แสดง path จริงที่โค้ด mount ไว้ (relative จาก base URL); path ที่ implement แล้วถูกแก้ให้ตรงกับ `*.routes.ts`
> - Debug/health ที่มีจริง: ✅ `GET /health`, ✅ `GET /debug/tables`, ✅ `GET /debug/users`

### 4.1 Authentication

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `POST` | `/auth/login` | Login with username/email + password |
| ✅ | `POST` | `/auth/refresh` | Refresh JWT access token |
| ✅ | `POST` | `/auth/change-password` | Change current user's password |
| ✅ | `GET`  | `/auth/me` | Get current user profile |
| 🔲 | `POST` | `/auth/logout` | Invalidate refresh token |
| 🔲 | `POST` | `/auth/reset-password` | Admin reset user password (ปัจจุบันใช้ `POST /users/:id/reset-password`) |

**Login Request:**
```json
{
  "username": "admin",
  "password": "••••••••",
  "siteId": 1
}
```

**Login Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g...",
    "expiresIn": 3600,
    "user": {
      "userId": 1,
      "userName": "admin",
      "displayName": "Administrator",
      "email": "admin@gmail.com",
      "group": "Administrator",
      "permissions": ["dashboard.view", "meter.manage", "alarm.manage"],
      "sites": [{ "siteId": 1, "siteName": "111PMT" }]
    }
  }
}
```

---

### 4.2 Company Management

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `GET`    | `/company` | Get company info |
| ✅ | `PUT`    | `/company` | Update company info |
| 🔲 | `POST`   | `/company/logo` | Upload company logo |

---

### 4.3 Site & Location Hierarchy

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `GET`    | `/sites` | List all sites |
| ✅ | `GET`    | `/sites/:siteId` | Get site detail |
| ✅ | `POST`   | `/sites` | Create new site |
| ✅ | `PUT`    | `/sites/:siteId` | Update site |
| ✅ | `DELETE` | `/sites/:siteId` | Delete site |
| ✅ | `GET`    | `/sites/:siteId/hierarchy` | Get full tree (Site → Buildings → Zones → Meters) |
| ✅ | `GET`    | `/sites/:siteId/buildings` | List buildings in site |
| ✅ | `GET`    | `/sites/:siteId/users` | List users mapped to site |
| ✅ | `PUT`    | `/sites/:siteId/users` | Set (bulk) users mapped to site |
| ✅ | `GET`    | `/sites/buildings/list` | List buildings (filterable by site) |
| ✅ | `GET`    | `/sites/buildings/:id` | Get building detail |
| ✅ | `POST`   | `/sites/buildings` | Create building (`siteId` in body) |
| ✅ | `PUT`    | `/sites/buildings/:id` | Update building |
| ✅ | `DELETE` | `/sites/buildings/:id` | Delete building |
| ✅ | `GET`    | `/sites/zones/list` | List zones (filterable by building) |
| ✅ | `GET`    | `/sites/zones/:id` | Get zone detail |
| ✅ | `POST`   | `/sites/zones` | Create zone (`buildingId` in body) |
| ✅ | `PUT`    | `/sites/zones/:id` | Update zone |
| ✅ | `DELETE` | `/sites/zones/:id` | Delete zone |

**Hierarchy Response Example:**
```json
{
  "success": true,
  "data": {
    "siteId": 1,
    "siteName": "111PMT",
    "buildings": [
      {
        "buildingId": 1,
        "buildingName": "111PMT_Building A",
        "zones": [
          {
            "zoneId": 1,
            "zoneName": "พลาซ่า",
            "isShowDashboard": true,
            "meterCount": 45
          }
        ]
      }
    ]
  }
}
```

---

### 4.4 Meter Management

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `GET`    | `/meters` | List all meters (with filters) |
| ✅ | `GET`    | `/meters/:meterId` | Get meter detail |
| ✅ | `POST`   | `/meters` | Create new meter |
| ✅ | `PUT`    | `/meters/:meterId` | Update meter |
| ✅ | `DELETE` | `/meters/:meterId` | Delete meter |
| ✅ | `POST`   | `/meters/import` | Import meters (bulk) |
| ✅ | `POST`   | `/meters/:meterId/manual-reading` | Submit manual meter reading |
| ✅ | `GET`    | `/meters/energy-values` | List all energy value types |
| ✅ | `GET`    | `/meters/brands/list` | List meter brands |
| ✅ | `POST`   | `/meters/brands` | Create meter brand |
| ✅ | `PUT`    | `/meters/brands/:id` | Update meter brand |
| ✅ | `DELETE` | `/meters/brands/:id` | Delete meter brand |
| ✅ | `GET`    | `/meters/types/list` | List meter types (ไฟฟ้า, น้ำ, แก๊ส) |
| ✅ | `POST`   | `/meters/types` | Create meter type |
| ✅ | `PUT`    | `/meters/types/:id` | Update meter type |
| ✅ | `DELETE` | `/meters/types/:id` | Delete meter type |
| ✅ | `GET`    | `/meters/loops/list` | List communication loops |
| ✅ | `POST`   | `/meters/loops` | Create loop |
| ✅ | `PUT`    | `/meters/loops/:id` | Update loop |
| ✅ | `DELETE` | `/meters/loops/:id` | Delete loop |
| 🔲 | `GET`    | `/meters/:meterId/children` | Get child meters (ปัจจุบันใช้ `parent_meter_id` filter) |
| 🔲 | `POST`   | `/meters/:meterId/children` | Add child meter |

**Meter Query Parameters:**
```
GET /meters?siteId=1&buildingId=1&zoneId=1&meterTypeId=1&isActive=true&page=1&limit=20&search=MDB
```

**Meter Response:**
```json
{
  "success": true,
  "data": {
    "meterId": 1,
    "meterCode": "0206213159",
    "meterName": "Main MDB L1 (L1-L4)",
    "address": 1,
    "brand": { "meterBrandId": 1, "meterBrandName": "Siemens", "modelName": "AB5478" },
    "type": { "meterTypeId": 1, "meterTypeName": "ไฟฟ้า", "iconName": "fa fa-bolt" },
    "loop": { "loopId": 1, "portNo": 2, "baudrate": 9600 },
    "site": { "siteId": 1, "siteName": "111PMT" },
    "building": { "buildingId": 1, "buildingName": "CP2" },
    "zone": { "zoneId": 1, "zoneName": "พลาซ่า" },
    "isActive": true,
    "status": "Manual"
  }
}
```

---

### 4.5 Meter Data & Monitoring

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `GET`    | `/meter-data/realtime` | Get latest readings for all meters |
| ✅ | `GET`    | `/meter-data/history` | Get historical data with time range |
| ✅ | `GET`    | `/meter-data/daily` | Get daily aggregated data |
| ✅ | `GET`    | `/meter-data/monthly` | Get monthly aggregated data |
| 🔲 | `GET`    | `/meter-data/realtime/:meterId` | Get latest reading for specific meter |
| 🔲 | `POST`   | `/meter-data` | Push new meter reading (IoT/Modbus) |
| 🔲 | `GET`    | `/meter-data/compare` | Compare two time periods |
| 🔲 | `WS`     | `/ws/meter-data` | WebSocket for real-time updates (ปัจจุบัน realtime มาทาง Redis pub/sub — ดู §4.13) |

**Realtime Query:**
```
GET /meter-data/realtime?siteId=1&meterTypeId=1&buildingId=1&zoneId=all
```

**Realtime Response:**
```json
{
  "success": true,
  "data": [
    {
      "meterId": 1,
      "meterName": "Main MDB L1",
      "meterCode": "0206213159",
      "roomCode": "Main MDB-L1",
      "roomName": "Common",
      "status": "Manual",
      "dateKeep": "2025-09-19T06:52:00Z",
      "readings": {
        "kWh": 4821035.90,
        "kva": 0.00,
        "kw": 0.00,
        "kvar": 0.00,
        "frequency": 0.00,
        "voltP1": 0.00,
        "voltP2": 0.00,
        "voltP3": 0.00,
        "amp1": 0.00,
        "amp2": 0.00,
        "amp3": 0.00,
        "pf1": 0.00,
        "pf2": 0.00,
        "pf3": 0.00,
        "thdV1": 0.00,
        "thdA1": 0.00,
        "waterValue": null,
        "gasValue": null
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

**Historical Query:**
```
GET /meter-data/history?meterId=1&startDate=2025-12-01&endDate=2025-12-16&interval=hourly
```

**WebSocket Events:**
```javascript
// Client subscribes to meter data
socket.emit('subscribe', { meterIds: [1, 2, 3], siteId: 1 });

// Server pushes updates
socket.on('meter-update', (data) => {
  // { meterId: 1, readings: {...}, timestamp: '...' }
});

// Server pushes alarm
socket.on('alarm-triggered', (data) => {
  // { alarmConfigId: 1, meterId: 1, type: 'HIGH', value: 450, threshold: 400 }
});
```

---

### 4.6 Alarm System

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `GET`    | `/alarms/configs` | List all alarm configurations |
| ✅ | `POST`   | `/alarms/configs` | Create alarm config |
| ✅ | `PUT`    | `/alarms/configs/:id` | Update alarm config |
| ✅ | `DELETE` | `/alarms/configs/:id` | Delete alarm config |
| ✅ | `GET`    | `/alarms/groups` | List alarm groups (for Telegram) |
| ✅ | `POST`   | `/alarms/groups` | Create alarm group |
| ✅ | `PUT`    | `/alarms/groups/:id` | Update alarm group |
| ✅ | `DELETE` | `/alarms/groups/:id` | Delete alarm group |
| 🔲 | `GET`    | `/alarms/configs/:id` | Get alarm config detail |
| 🔲 | `GET`    | `/alarms/groups/:id/telegram-chatid` | Get Telegram Chat ID |
| 🔲 | `GET`    | `/alarms/logs` | Get alarm history/logs |
| 🔲 | `POST`   | `/alarms/test/:groupId` | Send test alarm to Telegram |

**Alarm Config Request:**
```json
{
  "meterId": 1,
  "energyValueId": 14,
  "lowerValue": 180,
  "higherValue": 250,
  "lowerMessage": "⚠️ แรงดันต่ำ: Volt P1 ต่ำกว่า 180V",
  "higherMessage": "🔴 แรงดันสูง: Volt P1 สูงกว่า 250V",
  "isActive": true,
  "isLampOn": false,
  "isBuzzerOn": true,
  "lampAddress": 0,
  "buzzerAddress": 0
}
```

---

### 4.7 Demand Peak & Energy Saving

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `GET`    | `/billing/demand` | List demand peak configs |
| ✅ | `POST`   | `/billing/demand` | Create demand config |
| ✅ | `PUT`    | `/billing/demand/:id` | Update demand config |
| ✅ | `DELETE` | `/billing/demand/:id` | Delete demand config |
| 🔲 | `GET`    | `/demand/configs/:id/meters` | Get meters linked to demand config |
| 🔲 | `POST`   | `/demand/configs/:id/meters` | Link meters to demand config |
| 🔲 | `GET`    | `/demand/data` | Get demand peak data |
| 🔲 | `GET`    | `/demand/current` | Get current demand reading |
| 🔲 | `GET`    | `/saving/configs` | List saving meter configs |
| 🔲 | `POST`   | `/saving/configs` | Create saving config |
| 🔲 | `GET`    | `/saving/data` | Get energy saving data |
| 🔲 | `GET`    | `/saving/summary` | Get saving summary/target vs actual |

---

### 4.8 Billing & Usage

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `GET`    | `/billing/configs` | List billing rate configs |
| ✅ | `POST`   | `/billing/configs` | Create billing rate |
| ✅ | `PUT`    | `/billing/configs/:id` | Update billing rate |
| ✅ | `DELETE` | `/billing/configs/:id` | Delete billing rate |
| 🔲 | `GET`    | `/billing/current-rate` | Get current effective rate |
| 🔲 | `GET`    | `/billing/calculate` | Calculate bill for meter/period |
| 🔲 | `GET`    | `/usage/daily` | Get daily energy usage (tenant billing) |
| 🔲 | `POST`   | `/usage/daily/import` | Import daily usage from Excel |
| 🔲 | `GET`    | `/usage/daily/export` | Export daily usage to Excel |

**Bill Calculation:**
```
GET /billing/calculate?meterId=1&startDate=2025-12-01&endDate=2025-12-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "meterId": 1,
    "meterName": "Main MDB L1",
    "period": { "start": "2025-12-01", "end": "2025-12-31" },
    "previousKWh": 4800000.00,
    "currentKWh": 4821035.90,
    "usage": 21035.90,
    "unitPrice": 7.08,
    "amount": 148934.17,
    "effectiveRate": { "id": 5, "effectiveDate": "2023-01-13", "unitPrice": 7.08 }
  }
}
```

---

### 4.9 Layout & Floor Plans

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `GET`    | `/layouts` | List all floor plan layouts |
| ✅ | `GET`    | `/layouts/:layoutId` | Get layout detail with points |
| ✅ | `POST`   | `/layouts` | Create new layout |
| ✅ | `PUT`    | `/layouts/:layoutId` | Update layout |
| ✅ | `DELETE` | `/layouts/:layoutId` | Delete layout |
| ✅ | `GET`    | `/layouts/:layoutId/points` | Get meter points on layout |
| ✅ | `POST`   | `/layouts/:layoutId/points` | Add meter point |
| ✅ | `PUT`    | `/layouts/:layoutId/points` | Bulk set/replace meter points |
| ✅ | `PUT`    | `/layouts/:layoutId/points/:pointId` | Update point |
| ✅ | `DELETE` | `/layouts/:layoutId/points/:pointId` | Delete point |
| 🔲 | `POST`   | `/layouts/:layoutId/image` | Upload floor plan image |
| 🔲 | `GET`    | `/layouts/:layoutId/meter-configs` | Get meter display configs |
| 🔲 | `POST`   | `/layouts/:layoutId/meter-configs` | Set meter display config |
| 🔲 | `GET`    | `/layouts/:layoutId/live` | Get layout with live meter data |

---

### 4.10 Dashboard & Analytics

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `GET`    | `/dashboard/zone` | Zone dashboard data |
| ✅ | `GET`    | `/dashboard/zone-consumption` | Energy consumption by zone |
| ✅ | `GET`    | `/dashboard/mdb-consumption` | MDB consumption data |
| ✅ | `GET`    | `/dashboard/demand` | Demand dashboard data |
| ✅ | `GET`    | `/dashboard/consumption-table` | Consumption table data |
| 🔲 | `GET`    | `/dashboard/overview` | Overall energy consumption overview |
| 🔲 | `GET`    | `/dashboard/comparison` | Period comparison (week/month/year) |
| 🔲 | `GET`    | `/dashboard/top-consumers` | Top N energy consuming meters |
| 🔲 | `GET`    | `/dashboard/anomalies` | Unusual consumption patterns |

**Zone Consumption Query:**
```
GET /dashboard/zone-consumption?siteId=1&zoneId=all&period=this_week
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": { "start": "2025-12-10", "end": "2025-12-16", "label": "This Week" },
    "chartData": {
      "labels": ["2025-12-10", "2025-12-11", "2025-12-12", "2025-12-13", "2025-12-14", "2025-12-15", "2025-12-16"],
      "datasets": [
        {
          "label": "CDC-DB1-TOU1 (B)",
          "data": [28467.38, 22496.83, 14465.23, 35776.21, 21185.87, 663935.82, 215352421.35]
        }
      ]
    },
    "pieData": {
      "labels": ["CDC-DB1-TOU1 (B)", "CDC-DB1-TOU2 (C)", "CDC-DB1-TOU3 (D)"],
      "data": [12.7, 9.9, 14.3],
      "unit": "%"
    },
    "totalKWh": 250000000,
    "comparedToLastWeek": "+5.2%"
  }
}
```

---

### 4.11 Reports & Export

> ⚠️ ทั้งโมดูล Reports & Export ยังเป็น **planned** — ยังไม่มี `reports.routes.ts` ในโค้ด

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| 🔲 | `GET`    | `/reports/energy-consumption` | Energy consumption report |
| 🔲 | `GET`    | `/reports/meter-status` | Meter status report |
| 🔲 | `GET`    | `/reports/alarm-history` | Alarm history report |
| 🔲 | `GET`    | `/reports/billing-summary` | Billing summary report |
| 🔲 | `GET`    | `/reports/demand-peak` | Demand peak report |
| 🔲 | `POST`   | `/reports/export` | Export report as Excel/PDF |
| 🔲 | `GET`    | `/export/configs` | Get export configurations |
| 🔲 | `POST`   | `/export/configs` | Create export config |

**Report Query:**
```
GET /reports/energy-consumption?siteId=1&startDate=2025-12-01&endDate=2025-12-31&format=json&groupBy=daily
```

---

### 4.12 User & Permission Management

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `GET`    | `/users` | List all users |
| ✅ | `GET`    | `/users/:userId` | Get user detail |
| ✅ | `POST`   | `/users` | Create new user |
| ✅ | `PUT`    | `/users/:userId` | Update user |
| ✅ | `DELETE` | `/users/:userId` | Delete user (soft) |
| ✅ | `POST`   | `/users/:userId/reset-password` | Reset user password |
| ✅ | `GET`    | `/users/groups/list` | List user groups |
| ✅ | `GET`    | `/users/groups/:groupId` | Get group detail |
| ✅ | `POST`   | `/users/groups` | Create group |
| ✅ | `PUT`    | `/users/groups/:groupId` | Update group |
| ✅ | `DELETE` | `/users/groups/:groupId` | Delete group |
| ✅ | `GET`    | `/users/groups/:groupId/permissions` | Get group permissions |
| ✅ | `PUT`    | `/users/groups/:groupId/permissions` | Set group permissions |
| ✅ | `GET`    | `/sites/:siteId/users` | List users mapped to site |
| ✅ | `PUT`    | `/sites/:siteId/users` | Set (bulk) user↔site mapping |
| 🔲 | `POST`   | `/sites/:siteId/users` | Map single user to site (ปัจจุบันใช้ `PUT` bulk) |
| 🔲 | `DELETE` | `/sites/:siteId/users/:userId` | Remove user from site (ปัจจุบันใช้ `PUT` bulk) |
| 🔲 | `GET`    | `/audit-logs` | Get audit logs |

**User Create Request:**
```json
{
  "userName": "john.doe",
  "displayName": "John Doe",
  "email": "john.doe@company.com",
  "password": "SecurePass123!",
  "groupId": 3,
  "isActive": true,
  "siteIds": [1, 2]
}
```

---

### 4.13 Redis Pub/Sub (Realtime Transport)

โมดูล realtime transport ที่ implement จริง (mount ที่ `/redis`) — ใช้รับ/ส่ง realtime meter data ผ่าน Redis pub/sub แทน WebSocket ที่ยังเป็น planned ใน §4.5

| Status | Method | Endpoint | Description |
|:--:|--------|----------|-------------|
| ✅ | `POST`   | `/redis/publish` | Publish message ไปยัง channel |
| ✅ | `GET`    | `/redis/subscribe/:channel` | Subscribe channel (SSE stream) |
| ✅ | `GET`    | `/redis/channels` | List active channels |
| ✅ | `GET`    | `/redis/latest` | Get latest realtime payload |

---

## 5. Data Models

### Common Response Wrapper

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: ValidationError[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}
```

### Core Entity Models

```typescript
// === Infrastructure ===
interface Site {
  siteId: number;
  siteName: string;
}

interface Building {
  buildingId: number;
  buildingName: string;
  siteId: number;
  isActive: boolean;
  createdBy: string;
  createdOn: Date;
  lastModifiedBy?: string;
  lastModifiedOn?: Date;
}

interface Zone {
  zoneId: number;
  zoneName: string;
  buildingId: number;
  isShowDashboard: boolean;
}

// === Meters ===
interface Meter {
  meterId: number;
  meterCode: string;
  meterName: string;
  address: number;
  meterBrandId: number;
  meterTypeId: number;
  loopId: number;
  siteId: number;
  buildingId: number;
  zoneId: number;
  isActive: boolean;
  ipAddress?: string;
  portNumber?: number;
  protocolId?: number;
  roomCode?: string;
  roomName?: string;
}

interface MeterBrand {
  meterBrandId: number;
  meterBrandName: string;
  modelName?: string;
  notes?: string;
  isActive: boolean;
}

interface MeterType {
  meterTypeId: number;
  meterTypeName: string; // ไฟฟ้า, น้ำ, แก๊ส
  iconName?: string;     // fa fa-bolt, fa fa-tint, fa fa-fire
  isActive: boolean;
}

// === Meter Readings ===
interface MeterReading {
  meterId: number;
  dateKeep: Date;
  energyKva: number;
  energyKw: number;
  energyKvar: number;
  energyFrequency: number;
  energyVoltP1: number;
  energyVoltP2: number;
  energyVoltP3: number;
  energyVoltL1: number;
  energyVoltL2: number;
  energyVoltL3: number;
  energyAmp1: number;
  energyAmp2: number;
  energyAmp3: number;
  energyPf1: number;
  energyPf2: number;
  energyPf3: number;
  energyTHDV1: number;
  energyTHDA1: number;
  energyKWh: number;
  waterValue?: number;
  gasValue?: number;
  status: string;
}

// === Alarms ===
interface AlarmConfig {
  alarmConfigId: number;
  meterId: number;
  energyValueId: number;
  lowerValue: number;
  higherValue: number;
  lowerMessage?: string;
  higherMessage?: string;
  isActive: boolean;
  isLampOn: boolean;
  isBuzzerOn: boolean;
  lampAddress: number;
  buzzerAddress: number;
}

interface AlarmGroup {
  alarmGroupId: number;
  groupName: string;
  email: string;
  telegramToken: string;
  telegramChatId: string;
  isActive: boolean;
}

// === Users ===
interface AppUser {
  userId: number;
  userName: string;
  displayName: string;
  email: string;
  groupId: number;
  isActive: boolean;
  createdBy: string;
  createdOn: Date;
}

interface GroupUser {
  groupId: number;
  groupName: string; // Administrator, Guest, User, Technician, etc.
  isActive: boolean;
}

// === Billing ===
interface BillingConfig {
  id: number;
  effectiveDate: Date;
  unitPrice: number;
  isActive: boolean;
}

// === Demand Peak ===
interface DemandPeakConfig {
  configId: number;
  displayName: string;
  warningSetpoint: number;
  peakSetpoint: number;
  savingRate: number;
  flatRate: number;
  tou: number;
  savingTarget: number;
  isActive: boolean;
}
```

---

## 6. Error Handling

### Standard Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request validation failed |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Duplicate resource |
| 422 | `UNPROCESSABLE` | Business logic error |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "meterCode", "message": "Meter code is required" },
      { "field": "meterTypeId", "message": "Must be a valid meter type ID" }
    ]
  },
  "meta": {
    "timestamp": "2026-02-22T14:46:56+07:00",
    "requestId": "req_abc123"
  }
}
```

---

## 7. Security

### Authentication Flow

```
┌──────────┐                          ┌──────────┐
│  Client  │                          │  Server  │
└────┬─────┘                          └────┬─────┘
     │  POST /auth/login                   │
     │  { username, password }              │
     ├────────────────────────────────────►│
     │                                     │ Verify password (bcrypt)
     │                                     │ Generate JWT access + refresh
     │  { accessToken, refreshToken }      │
     │◄────────────────────────────────────┤
     │                                     │
     │  GET /meters                        │
     │  Authorization: Bearer <token>      │
     ├────────────────────────────────────►│
     │                                     │ Verify JWT
     │                                     │ Check permissions
     │  { data: [...] }                    │
     │◄────────────────────────────────────┤
     │                                     │
     │  POST /auth/refresh                 │
     │  { refreshToken }                   │
     ├────────────────────────────────────►│
     │                                     │ Validate refresh token
     │  { newAccessToken }                 │
     │◄────────────────────────────────────┤
```

### Permission Matrix

| Group | Dashboard | Monitoring | Meters | Alarms | Users | Billing | Reports |
|-------|-----------|------------|--------|--------|-------|---------|---------|
| **Administrator** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Technician** | ✅ View | ✅ Full | ✅ Full | ✅ Full | ❌ | ❌ | ✅ View |
| **Tenant Service** | ✅ View | ✅ View | ✅ View | ❌ | ❌ | ✅ View | ✅ View |
| **User** | ✅ View | ✅ View | ❌ | ❌ | ❌ | ❌ | ✅ View |
| **View** | ✅ View | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Guest** | ✅ View | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Security Measures

- **Password Storage**: bcrypt with salt rounds = 12
- **JWT**: HS256 algorithm, 24h access token, 7d refresh token
- **Rate Limiting**: 100 req/min per user, 1000 req/min per IP
- **CORS**: Whitelist specific origins
- **Input Sanitization**: SQL injection prevention via parameterized queries
- **Audit Logging**: All write operations logged to `auditlogs` table
- **HTTPS**: Required in production

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1-2) 🏗️
- [ ] Project scaffolding (Express.js + TypeScript)
- [ ] Database connection pool (pg)
- [ ] Authentication module (JWT)
- [ ] Common middleware (error handling, validation, auth)
- [ ] User & Group CRUD APIs
- [ ] Swagger/OpenAPI documentation setup

### Phase 2: Core Data (Week 3-4) ⚡
- [ ] Site/Building/Zone hierarchy APIs
- [ ] Meter CRUD APIs
- [ ] Meter Brand/Type/Loop APIs
- [ ] Realtime meter data API
- [ ] Historical meter data API (with pagination)
- [ ] Redis pub/sub + polling for live meter monitoring

### Phase 3: Business Logic (Week 5-6) 📊
- [ ] Alarm configuration APIs
- [ ] Alarm Telegram integration
- [ ] Billing configuration & calculation APIs
- [ ] Demand peak configuration APIs
- [ ] Energy saving APIs
- [ ] 15-minute / Daily / Monthly aggregation scheduler + retention cleanup

### Phase 4: Dashboard & Reports (Week 7-8) 📈
- [ ] Zone consumption dashboard API
- [ ] MDB consumption dashboard API
- [ ] Demand dashboard API
- [ ] Report generation APIs
- [ ] Excel/PDF export functionality

### Phase 5: Layout & Polish (Week 9-10) 🎨
- [ ] Floor plan layout APIs
- [ ] Layout position management
- [ ] Live layout with meter data overlay
- [ ] Company settings API
- [ ] Performance optimization (caching, query optimization)
- [ ] Comprehensive testing

---

## Quick Start

```bash
# Initial project setup
mkdir energyplus-api && cd energyplus-api
npm init -y
npm install express pg jsonwebtoken bcryptjs cors helmet
npm install zod morgan winston node-cron
npm install -D typescript @types/express @types/node nodemon ts-node
npm install -D @types/jsonwebtoken @types/bcryptjs @types/cors

# Environment configuration
cp .env.example .env

# Start development
npm run dev
```

### Project Structure

```
energyplus-api/
├── src/
│   ├── config/
│   │   ├── database.ts          # PostgreSQL connection pool
│   │   ├── jwt.ts               # JWT configuration
│   │   └── app.ts               # Express app config
│   ├── middleware/
│   │   ├── auth.ts              # JWT authentication
│   │   ├── permission.ts        # Role-based access control
│   │   ├── validate.ts          # Request validation
│   │   ├── rateLimiter.ts       # Rate limiting
│   │   └── errorHandler.ts      # Global error handler
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.validator.ts
│   │   ├── meters/
│   │   │   ├── meter.controller.ts
│   │   │   ├── meter.service.ts
│   │   │   ├── meter.routes.ts
│   │   │   ├── meter.validator.ts
│   │   │   └── meter.model.ts
│   │   ├── meter-data/
│   │   │   ├── meterData.controller.ts
│   │   │   ├── meterData.service.ts
│   │   │   ├── meterData.routes.ts
│   │   │   └── meterData.realtime.ts
│   │   ├── alarms/
│   │   ├── sites/
│   │   ├── buildings/
│   │   ├── zones/
│   │   ├── billing/
│   │   ├── demand/
│   │   ├── layouts/
│   │   ├── dashboard/
│   │   ├── reports/
│   │   ├── users/
│   │   └── company/
│   ├── services/
│   │   ├── telegram.ts          # Telegram notification service
│   │   ├── scheduler.ts         # Data aggregation scheduler
│   │   └── exporter.ts          # Excel/PDF export service
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── pagination.ts
│   │   └── dateUtils.ts
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   └── server.ts                # Entry point
├── tests/
├── docs/
│   └── openapi.yaml             # API documentation
├── .env.example
├── tsconfig.json
├── package.json
└── README.md
```
