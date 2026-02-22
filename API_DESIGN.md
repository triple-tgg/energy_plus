# EnergyPlus API Design Document

> **Version**: 1.1  
> **Date**: February 22, 2026  
> **Database**: PostgreSQL (DigitalOcean Managed Database — `energy_plus`)  
> **Existing Frontend**: ASP.NET MVC (C#) — hosted at `energyplus.kegroup.co.th:5500`  
> **New Backend**: Node.js + Express + TypeScript (`new-energy-plus/backend`)

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
│  │      PostgreSQL (DigitalOcean Managed)       │                │
│  │         Database: energy_plus                │                │
│  │         Host: *.c.db.ondigitalocean.com      │                │
│  │         Port: 25060 (SSL)                    │                │
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
| **Provider** | DigitalOcean Managed PostgreSQL |
| **Host** | `db-postgresql-sgp1-56999-do-user-3547454-0.c.db.ondigitalocean.com` |
| **Port** | `25060` |
| **Database** | `energy_plus` |
| **User** | `energyadmin` |
| **Password** | `<SET_IN_ENV>` |
| **SSL** | Required (`sslmode=require`) |
| **Region** | SGP1 (Singapore) |

### Environment Variables (`.env`)

```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration (DigitalOcean PostgreSQL)
DB_HOST=db-postgresql-sgp1-56999-do-user-3547454-0.c.db.ondigitalocean.com
DB_PORT=25060
DB_DATABASE=energy_plus
DB_USER=energyadmin
DB_PASSWORD=<your_db_password>
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Logging
LOG_LEVEL=debug
```

### Connection Pool Configuration (`src/config/database.ts`)

```typescript
import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = {
  user: process.env.DB_USER || 'energyadmin',
  host: process.env.DB_HOST || 'db-postgresql-sgp1-56999-do-user-3547454-0.c.db.ondigitalocean.com',
  database: process.env.DB_DATABASE || 'energy_plus',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '25060', 10),
  max: 20,                        // Max connections in pool
  idleTimeoutMillis: 30000,       // Close idle connections after 30s
  connectionTimeoutMillis: 2000,  // Fail if can't connect in 2s
  ssl: { rejectUnauthorized: false },  // Required for DigitalOcean
};

const pool = new Pool(poolConfig);
```

### Connection String (URI Format)

```
postgresql://energyadmin:<your_db_password>@db-postgresql-sgp1-56999-do-user-3547454-0.c.db.ondigitalocean.com:25060/energy_plus?sslmode=require
```

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Node.js 20 LTS | Event-driven, ideal for real-time meter data |
| **Framework** | Express.js + TypeScript | Lightweight, type-safe, mature ecosystem |
| **Database Driver** | pg (node-postgres) | Native PostgreSQL driver with pool management |
| **Query Builder** | Knex.js | Flexible SQL building without heavy ORM overhead |
| **Authentication** | JWT (jsonwebtoken) | Stateless auth, compatible with existing ASP.NET Identity |
| **Validation** | Joi / Zod | Schema-based request validation |
| **Real-time** | Socket.IO | WebSocket for live meter monitoring |
| **Scheduler** | node-cron | Periodic data aggregation tasks |
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
             │                   │                    ├── actual_meter_data (N)
             │                   │                    ├── actual_meter_data_daily (N)
             │                   │                    ├── actual_meter_data_monthly (N)
             │                   │                    ├── alarm_config (N)
             │                   │                    └── child_meter (N)
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
                                                                  
layouts (1) ──┬── layout_position (N)                            
              └── layout_meter_config (N)                        
                                                                  
demand_peak_config (1) ──── demand_meter_config (N)              
                       ──── demand_peak_data (N)                 
                                                                  
alarm_group (1) ──── alarm_group_mapping (N)                     
billing_config                                                    
energy_daily_usage                                                
energy_save                                                       
saving_meter_config                                               
```

### Key Tables by Domain

| Domain | Tables | Records (approx) |
|--------|--------|-------------------|
| **Infrastructure** | `sites`, `buildings`, `zones` | ~3, ~5, ~12 |
| **Meters** | `meter`, `meter_brand`, `meter_type`, `loop`, `protocol` | ~500+, ~10, ~3, ~16 |
| **Meter Data** | `actual_meter_data`, `actual_meter_data_daily`, `actual_meter_data_monthly` | Large (221MB daily!) |
| **Energy** | `energy_value`, `energy_daily_usage`, `energy_save` | ~39 value types |
| **Alarms** | `alarm_config`, `alarm_group`, `alarm_group_mapping` | Config-based |
| **Demand** | `demand_peak_config`, `demand_meter_config`, `demand_peak_data` | Config-based |
| **Billing** | `billing_config` | ~4 rate configs |
| **Users** | `app_user`, `group_user`, `user_permission`, `site_user_map`, `aspnetusers` | ~81 users |
| **Layouts** | `layouts`, `layout_position`, `layout_meter_config` | ~50 layouts |
| **Company** | `company` | 1 |
| **Audit** | `auditlogs`, `write_log` | Growing |

---

## 4. API Modules & Endpoints

**Base URL**: `https://api.energyplus.kegroup.co.th/api/v1`

### 4.1 Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Login with username/email + password |
| `POST` | `/auth/refresh` | Refresh JWT access token |
| `POST` | `/auth/logout` | Invalidate refresh token |
| `POST` | `/auth/change-password` | Change current user's password |
| `POST` | `/auth/reset-password` | Admin reset user password |
| `GET`  | `/auth/me` | Get current user profile |

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/company` | Get company info |
| `PUT`    | `/company` | Update company info |
| `POST`   | `/company/logo` | Upload company logo |

---

### 4.3 Site & Location Hierarchy

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/sites` | List all sites |
| `GET`    | `/sites/:siteId` | Get site detail |
| `POST`   | `/sites` | Create new site |
| `PUT`    | `/sites/:siteId` | Update site |
| `DELETE` | `/sites/:siteId` | Delete site |
| `GET`    | `/sites/:siteId/buildings` | List buildings in site |
| `POST`   | `/sites/:siteId/buildings` | Create building |
| `PUT`    | `/buildings/:buildingId` | Update building |
| `DELETE` | `/buildings/:buildingId` | Delete building |
| `GET`    | `/buildings/:buildingId/zones` | List zones in building |
| `POST`   | `/buildings/:buildingId/zones` | Create zone |
| `PUT`    | `/zones/:zoneId` | Update zone |
| `DELETE` | `/zones/:zoneId` | Delete zone |
| `GET`    | `/sites/:siteId/hierarchy` | Get full tree (Site → Buildings → Zones → Meters) |

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/meters` | List all meters (with filters) |
| `GET`    | `/meters/:meterId` | Get meter detail |
| `POST`   | `/meters` | Create new meter |
| `PUT`    | `/meters/:meterId` | Update meter |
| `DELETE` | `/meters/:meterId` | Delete meter |
| `GET`    | `/meters/:meterId/children` | Get child meters |
| `POST`   | `/meters/:meterId/children` | Add child meter |
| `GET`    | `/meter-brands` | List meter brands |
| `POST`   | `/meter-brands` | Create meter brand |
| `PUT`    | `/meter-brands/:id` | Update meter brand |
| `DELETE` | `/meter-brands/:id` | Delete meter brand |
| `GET`    | `/meter-types` | List meter types (ไฟฟ้า, น้ำ, แก๊ส) |
| `POST`   | `/meter-types` | Create meter type |
| `PUT`    | `/meter-types/:id` | Update meter type |
| `GET`    | `/loops` | List communication loops |
| `POST`   | `/loops` | Create loop |
| `PUT`    | `/loops/:loopId` | Update loop |
| `GET`    | `/energy-values` | List all energy value types |

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/meter-data/realtime` | Get latest readings for all meters |
| `GET`    | `/meter-data/realtime/:meterId` | Get latest reading for specific meter |
| `POST`   | `/meter-data` | Push new meter reading (IoT/Modbus) |
| `GET`    | `/meter-data/history` | Get historical data with time range |
| `GET`    | `/meter-data/daily` | Get daily aggregated data |
| `GET`    | `/meter-data/monthly` | Get monthly aggregated data |
| `GET`    | `/meter-data/compare` | Compare two time periods |
| `WS`     | `/ws/meter-data` | WebSocket for real-time updates |

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/alarms/configs` | List all alarm configurations |
| `GET`    | `/alarms/configs/:id` | Get alarm config detail |
| `POST`   | `/alarms/configs` | Create alarm config |
| `PUT`    | `/alarms/configs/:id` | Update alarm config |
| `DELETE` | `/alarms/configs/:id` | Delete alarm config |
| `GET`    | `/alarms/groups` | List alarm groups (for Telegram) |
| `POST`   | `/alarms/groups` | Create alarm group |
| `PUT`    | `/alarms/groups/:id` | Update alarm group |
| `DELETE` | `/alarms/groups/:id` | Delete alarm group |
| `GET`    | `/alarms/groups/:id/telegram-chatid` | Get Telegram Chat ID |
| `GET`    | `/alarms/logs` | Get alarm history/logs |
| `POST`   | `/alarms/test/:groupId` | Send test alarm to Telegram |

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/demand/configs` | List demand peak configs |
| `POST`   | `/demand/configs` | Create demand config |
| `PUT`    | `/demand/configs/:id` | Update demand config |
| `GET`    | `/demand/configs/:id/meters` | Get meters linked to demand config |
| `POST`   | `/demand/configs/:id/meters` | Link meters to demand config |
| `GET`    | `/demand/data` | Get demand peak data |
| `GET`    | `/demand/current` | Get current demand reading |
| `GET`    | `/saving/configs` | List saving meter configs |
| `POST`   | `/saving/configs` | Create saving config |
| `GET`    | `/saving/data` | Get energy saving data |
| `GET`    | `/saving/summary` | Get saving summary/target vs actual |

---

### 4.8 Billing & Usage

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/billing/configs` | List billing rate configs |
| `POST`   | `/billing/configs` | Create billing rate |
| `PUT`    | `/billing/configs/:id` | Update billing rate |
| `DELETE` | `/billing/configs/:id` | Delete billing rate |
| `GET`    | `/billing/current-rate` | Get current effective rate |
| `GET`    | `/billing/calculate` | Calculate bill for meter/period |
| `GET`    | `/usage/daily` | Get daily energy usage (tenant billing) |
| `POST`   | `/usage/daily/import` | Import daily usage from Excel |
| `GET`    | `/usage/daily/export` | Export daily usage to Excel |

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/layouts` | List all floor plan layouts |
| `GET`    | `/layouts/:layoutId` | Get layout detail with positions |
| `POST`   | `/layouts` | Create new layout |
| `PUT`    | `/layouts/:layoutId` | Update layout |
| `DELETE` | `/layouts/:layoutId` | Delete layout |
| `POST`   | `/layouts/:layoutId/image` | Upload floor plan image |
| `GET`    | `/layouts/:layoutId/positions` | Get meter positions on layout |
| `POST`   | `/layouts/:layoutId/positions` | Set meter positions |
| `PUT`    | `/layouts/:layoutId/positions/:posId` | Update position |
| `GET`    | `/layouts/:layoutId/meter-configs` | Get meter display configs |
| `POST`   | `/layouts/:layoutId/meter-configs` | Set meter display config |
| `GET`    | `/layouts/:layoutId/live` | Get layout with live meter data |

---

### 4.10 Dashboard & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/dashboard/zone-consumption` | Energy consumption by zone |
| `GET`    | `/dashboard/mdb-consumption` | MDB consumption data |
| `GET`    | `/dashboard/demand` | Demand dashboard data |
| `GET`    | `/dashboard/consumption-chart` | Consumption chart data (bar + pie) |
| `GET`    | `/dashboard/overview` | Overall energy consumption overview |
| `GET`    | `/dashboard/comparison` | Period comparison (week/month/year) |
| `GET`    | `/dashboard/top-consumers` | Top N energy consuming meters |
| `GET`    | `/dashboard/anomalies` | Unusual consumption patterns |

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/reports/energy-consumption` | Energy consumption report |
| `GET`    | `/reports/meter-status` | Meter status report |
| `GET`    | `/reports/alarm-history` | Alarm history report |
| `GET`    | `/reports/billing-summary` | Billing summary report |
| `GET`    | `/reports/demand-peak` | Demand peak report |
| `POST`   | `/reports/export` | Export report as Excel/PDF |
| `GET`    | `/export/configs` | Get export configurations |
| `POST`   | `/export/configs` | Create export config |

**Report Query:**
```
GET /reports/energy-consumption?siteId=1&startDate=2025-12-01&endDate=2025-12-31&format=json&groupBy=daily
```

---

### 4.12 User & Permission Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/users` | List all users |
| `GET`    | `/users/:userId` | Get user detail |
| `POST`   | `/users` | Create new user |
| `PUT`    | `/users/:userId` | Update user |
| `DELETE` | `/users/:userId` | Delete user (soft) |
| `POST`   | `/users/:userId/reset-password` | Reset user password |
| `GET`    | `/groups` | List user groups |
| `POST`   | `/groups` | Create group |
| `PUT`    | `/groups/:groupId` | Update group |
| `DELETE` | `/groups/:groupId` | Delete group |
| `GET`    | `/groups/:groupId/permissions` | Get group permissions |
| `PUT`    | `/groups/:groupId/permissions` | Set group permissions |
| `GET`    | `/sites/:siteId/users` | List users mapped to site |
| `POST`   | `/sites/:siteId/users` | Map user to site |
| `DELETE` | `/sites/:siteId/users/:userId` | Remove user from site |
| `GET`    | `/audit-logs` | Get audit logs |

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
- **JWT**: RS256 algorithm, 1h access token, 7d refresh token
- **Rate Limiting**: 100 req/min per user, 1000 req/min per IP
- **CORS**: Whitelist specific origins
- **Input Sanitization**: SQL injection prevention via parameterized queries
- **Audit Logging**: All write operations logged to `auditlogs` table
- **HTTPS**: Required in production

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1-2) 🏗️
- [ ] Project scaffolding (Express.js + TypeScript)
- [ ] Database connection pool (mysql2)
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
- [ ] WebSocket for live meter monitoring

### Phase 3: Business Logic (Week 5-6) 📊
- [ ] Alarm configuration APIs
- [ ] Alarm Telegram integration
- [ ] Billing configuration & calculation APIs
- [ ] Demand peak configuration APIs
- [ ] Energy saving APIs
- [ ] Daily/Monthly data aggregation scheduler

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
npm install express mysql2 knex jsonwebtoken bcryptjs cors helmet
npm install joi morgan winston socket.io node-cron
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
│   │   ├── database.ts          # MySQL connection pool
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
│   │   │   └── meterData.websocket.ts
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
