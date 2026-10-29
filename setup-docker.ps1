wsl --status
wsl --install
docker desktop 

New-Item -ItemType Directory -Force -Path C:\MSoft
New-Item -ItemType Directory -Force -Path C:\MSoft\data\postgres
New-Item -ItemType Directory -Force -Path C:\MSoft\data\redis
New-Item -ItemType Directory -Force -Path C:\MSoft\data\garnet
New-Item -ItemType Directory -Force -Path C:\MSoft\backup
New-Item -ItemType Directory -Force -Path C:\MSoft\config

# ======================================================
# Option 1: Redis (Linux container)
# ======================================================
docker volume create redis-data
docker run -d `
  --name redis `
  --restart unless-stopped `
  -p 6379:6379 `
  -v "C:\MSoft\data\redis:/data" `
  redis:latest `
  redis-server --appendonly yes --requirepass "3Dv-M2Rv4oOa"

# ======================================================
# Option 2: Microsoft Garnet (แนะนำสำหรับ Windows)
# - MIT License, open source จาก Microsoft Research
# - ใช้ RESP protocol เดียวกับ Redis → ใช้ Redis client เดิมได้เลย
# - ประสิทธิภาพสูงทั้ง Linux และ Windows
# - ใช้จริงใน Azure Resource Manager, Azure Resource Graph
# ======================================================
docker run -d `
  --name garnet `
  --restart unless-stopped `
  -p 6379:6379 `
  -v "C:\MSoft\data\garnet:/data" `
  --ulimit memlock=-1 `
  ghcr.io/microsoft/garnet `
  --auth Password --password "3Dv-M2Rv4oOa" `
  --checkpointdir /data --recover --aof

# ======================================================
# หมายเหตุ: เลือก Option 1 (Redis) หรือ Option 2 (Garnet) อย่างใดอย่างหนึ่ง
# ทั้งสองใช้ port 6379 เหมือนกัน config .env ไม่ต้องเปลี่ยน
# ถ้าเปลี่ยนจาก Redis → Garnet ต้อง stop/remove Redis ก่อน:
#   docker rm -f redis
# แล้วค่อยรัน Garnet (หรือกลับกัน)
# ======================================================


# ทดสอบ connection (ใช้ได้ทั้ง Redis และ Garnet)
# docker exec -it redis redis-cli -a "3Dv-M2Rv4oOa"
# หรือ
# redis-cli -h 127.0.0.1 -p 6379 -a "3Dv-M2Rv4oOa"
AUTH 3Dv-M2Rv4oOa
PING

SET meter:TEST001:power 1250
GET meter:TEST001:power


REDIS_HOST=192.168.20.62
REDIS_PORT=6379
REDIS_PASSWORD=3Dv-M2Rv4oOa

docker volume create postgres-data
docker run -d `
  --name postgres `
  --restart unless-stopped `
  -p 5432:5432 `
  -e POSTGRES_DB=energy_plus `
  -e POSTGRES_USER=energyadmin `
  -e POSTGRES_PASSWORD="%9Du68R,56Br" `
  -v "C:\MSoft\data\postgres:/var/lib/postgresql/data" `
  postgres:17


docker exec -it redis redis-cli -a "3Dv-M2Rv4oOa"

docker network create msoft-network

# เชื่อม network (เลือกตามที่ใช้: redis หรือ garnet)
docker network connect msoft-network redis
# docker network connect msoft-network garnet    # ← uncomment ถ้าใช้ Garnet แทน Redis

docker network connect msoft-network postgres

docker network inspect msoft-network

docker pull ghcr.io/triple-tgg/energy-plus:wanwanach
docker pull ghcr.io/triple-tgg/energy-plus:production

docker rm -f energy-plus

docker run -d `
  --name energy-plus `
  --restart unless-stopped `
  --network msoft-network `
  --env-file C:\MSoft\.env `
  -p 23000:3000 `
  ghcr.io/triple-tgg/energy-plus:production

docker exec -it redis redis-cli
AUTH <Redis Password ที่อยู่ใน C:\MSoft\.env>



-------------------------------
.env (ใช้ได้ทั้ง Redis และ Garnet — config เหมือนกัน)

NODE_ENV=production
PORT=3000

# PostgreSQL - Docker Local
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=energy_plus
DB_USER=energyadmin
DB_PASSWORD=%9Du68R,56Br

# Cache Server - Docker Local
# ใช้ได้ทั้ง Redis หรือ Garnet (RESP protocol เดียวกัน)
# ถ้าใช้ Redis  → REDIS_HOST=redis
# ถ้าใช้ Garnet → REDIS_HOST=garnet
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=3Dv-M2Rv4oOa
REDIS_ENABLED=true

# Authentication
JWT_SECRET=EB4GKl7BJ0cv3pxPD1Cm17/DajiB9xLHd6AIMH7/aO9Vus/u6MI5Yu8hzDZRKTIwi6aPjFmFDRxyPhdHgEr5GA==
JWT_EXPIRES_IN=24h

# Web Application
CORS_ORIGIN=*

# Aggregation
AGGREGATION_CLEANUP_BATCH_SIZE=10000
AGGREGATION_DAILY_CRON=0 0 * * *
AGGREGATION_ENABLED=true
AGGREGATION_LOOKBACK_MINUTES=5
AGGREGATION_MINUTE_CRON=* * * * *
AGGREGATION_MONTHLY_CRON=0 0 20 * *
AGGREGATION_RETENTION_CRON=30 2 * * *
AGGREGATION_RETENTION_MONTHS=3
AGGREGATION_TIMEZONE=Asia/Bangkok