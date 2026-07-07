# Realtime Aggregation Job Plan

แผนงานสำหรับทำ background job สรุปข้อมูลจาก `meter_data_realtime` ไปยังตารางราย 15 นาที/รายวัน/รายเดือน และลบ raw realtime data ตาม retention policy

> ## ✅ สถานะ: Implemented (sync กับ code ณ `2026-07-07`)
>
> แผนนี้ถูก implement แล้วในโค้ดจริง — map ไปยังไฟล์:
> - **Job logic**: `backend/src/modules/aggregation/aggregation.service.ts`
> - **Scheduler (cron)**: `backend/src/modules/aggregation/aggregation.scheduler.ts`
> - **Config**: `backend/src/config/aggregation.ts` — cron จริง: minute `*/15 * * * *`, daily `0 0 * * *`, monthly `0 0 20 * *`, retention `30 2 * * *`, `retentionMonths=3` (ปรับผ่าน env `AGGREGATION_*`)
> - **Realtime mapping table**: `realtime_meter_map` (8 แถว), **Job audit table**: `aggregation_job_runs` (2,943 แถว)
> - **Scripts**: `scripts/backfill-aggregation.ts`, `scripts/test-aggregation.ts`, `scripts/add-aggregation-indexes.ts`
> - Granularity เป็นไปตามหมายเหตุด้านล่าง: minute snapshot → `actual_meter_data`, daily → `actual_meter_data_daily`, monthly → `actual_meter_data_monthly`
>
> หมายเหตุข้อมูล: 3 ตาราง snapshot ถูก truncate เมื่อ `2026-07-07` (ปัจจุบัน 0 แถว) และจะถูก populate ใหม่โดย job นี้

## เป้าหมาย

1. ทุก 15 นาที สรุปข้อมูลจาก `meter_data_realtime` ลง `actual_meter_data`
2. ทุก 1 วัน สรุปข้อมูลรายวันลง `actual_meter_data_daily`
3. ทุก 1 เดือน สรุปข้อมูลรายเดือนลง `actual_meter_data_monthly`
4. ลบข้อมูลใน `meter_data_realtime` โดยเก็บเฉพาะ 3 เดือนล่าสุด และปรับจำนวนเดือนได้จาก config

หมายเหตุ: requirement ข้อ 2 ระบุว่า “ลงใน `actual_meter_data`” แต่ schema ปัจจุบันมี `actual_meter_data_daily` สำหรับข้อมูลรายวันอยู่แล้ว จึงแนะนำให้เก็บ minute snapshot ใน `actual_meter_data` และเก็บ daily aggregate ใน `actual_meter_data_daily` เพื่อไม่ให้ข้อมูลคนละ granularity ปนกันใน table เดียว

## สถานะปัจจุบัน

| Table | สถานะข้อมูล | การใช้งานปัจจุบัน |
|---|---:|---|
| `meter_data_realtime` | มีข้อมูลจำนวนมากและยังไหลเข้าอยู่ | รับข้อมูลจาก Redis Pub/Sub |
| `actual_meter_data` | มีข้อมูล 15-minute snapshot แล้ว | API realtime/history/dashboard อ่านจาก table นี้ |
| `actual_meter_data_daily` | มีข้อมูล daily snapshot แล้ว | ใช้เป็นแหล่งข้อมูลสรุปรายวัน |
| `actual_meter_data_monthly` | มีข้อมูล monthly snapshot แล้ว | ใช้เป็นแหล่งข้อมูลสรุปรายเดือน |

## หลักการออกแบบ

- Job ต้อง idempotent: รันซ้ำช่วงเวลาเดิมแล้วไม่สร้างข้อมูลซ้ำ
- ใช้ DB transaction ต่อหนึ่งรอบ aggregation
- ใช้ advisory lock กัน job ซ้อนกันเมื่อมีหลาย process/server instance
- ใช้ watermark หรือ time bucket ชัดเจน เช่น minute/day/month bucket
- ใช้ `received_at` เป็นเวลารับเข้าระบบสำหรับการเลือกช่วงข้อมูล และใช้ `device_datetime` เป็นเวลาจากอุปกรณ์เพื่ออ้างอิงเพิ่มเติม
- Mapping meter ใช้ `meter_data_realtime.site_id = meter.site_id` และ `meter_data_realtime.address_id = meter.address`
- ในข้อมูลจริงพบว่า realtime `site_id/address_id` ไม่ตรงกับ `meter.site_id/address` เสมอ จึงเพิ่ม `realtime_meter_map` เพื่อ map channel/site/address ไปยัง `meter_id` แบบ explicit
- ถ้า realtime row หา `meter_id` ไม่เจอ ให้ skip และ log จำนวนไว้

## Config ที่ต้องเพิ่ม

เพิ่มใน `backend/.env` และอ่านผ่าน config module:

```env
AGGREGATION_ENABLED=true
AGGREGATION_MINUTE_CRON=*/15 * * * *
AGGREGATION_DAILY_CRON=0 0 * * *
AGGREGATION_MONTHLY_CRON=0 0 20 * *
AGGREGATION_RETENTION_CRON=30 2 * * *
AGGREGATION_RETENTION_MONTHS=3
AGGREGATION_TIMEZONE=Asia/Bangkok
AGGREGATION_INTERVAL_MINUTES=15
AGGREGATION_LOOKBACK_MINUTES=30
```

ความหมาย:
- `AGGREGATION_INTERVAL_MINUTES`: ขนาด bucket ของข้อมูลสรุป เช่น 15 นาที
- `AGGREGATION_LOOKBACK_MINUTES`: เผื่อข้อมูลมาช้า เช่น job ตอน 10:30 จะประมวลผลย้อนหลังถึง 10:00 แล้ว upsert ทับ bucket เดิม
- `AGGREGATION_RETENTION_MONTHS`: default 3 เดือน ปรับได้โดยไม่แก้ code

## Schema / Index ที่ควรเพิ่ม

### 1. กันข้อมูลซ้ำใน aggregate tables

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_actual_meter_data_meter_date
ON actual_meter_data (meter_id, date_keep);

CREATE UNIQUE INDEX IF NOT EXISTS uq_actual_meter_data_daily_meter_date
ON actual_meter_data_daily (meter_id, date_keep);

CREATE UNIQUE INDEX IF NOT EXISTS uq_actual_meter_data_monthly_meter_month
ON actual_meter_data_monthly (meter_id, year_month);
```

### 2. เพิ่ม index สำหรับอ่าน raw realtime ตามช่วงเวลา

```sql
CREATE INDEX IF NOT EXISTS idx_meter_realtime_received_bucket
ON meter_data_realtime (received_at, site_id, address_id);

CREATE INDEX IF NOT EXISTS idx_meter_site_address
ON meter (site_id, address);
```

### 3. Optional: job run log

แนะนำเพิ่ม table เพื่อ debug/monitor job:

```sql
CREATE TABLE IF NOT EXISTS aggregation_job_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL,
  bucket_start TIMESTAMPTZ,
  bucket_end TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL,
  rows_read INTEGER DEFAULT 0,
  rows_written INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
```

### 4. Optional: realtime meter mapping

เพิ่ม table นี้เพื่อรองรับกรณี `meter_data_realtime.site_id/address_id` ไม่ตรงกับ master `meter` โดยตรง:

```sql
CREATE TABLE IF NOT EXISTS realtime_meter_map (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(100),
  realtime_site_id INTEGER NOT NULL,
  realtime_address_id INTEGER NOT NULL,
  meter_id INTEGER NOT NULL REFERENCES meter(meter_id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

ตัวอย่าง:

```sql
INSERT INTO realtime_meter_map (
  channel, realtime_site_id, realtime_address_id, meter_id
)
VALUES (
  'project1_1000_1', 1000, 1, 31
);
```

ให้เปลี่ยน `meter_id` เป็น meter ที่ถูกต้องจริงก่อนเปิด job

## Data Mapping

### `meter_data_realtime` -> `actual_meter_data`

| Source | Target | วิธีสรุป |
|---|---|---|
| `meter.site_id + meter.address` จาก `site_id + address_id` | `meter_id` | join หา meter |
| 15-minute bucket จาก `received_at` | `date_keep` | `floor เป็นช่วง 15 นาทีจาก received_at` |
| `kva_3ph` | `energy_kva` | Last value ใน bucket |
| `kw_3ph` | `energy_kw` | Last value ใน bucket |
| `kvar_3ph` | `energy_kvar` | Last value ใน bucket |
| `hz` | `energy_frequency` | Last value ใน bucket |
| `vl1`, `vl2`, `vl3` | `energy_volt_p1/p2/p3` | Last value ใน bucket |
| `vl12`, `vl23`, `vl31` | `energy_volt_l1/l2/l3` | Last value ใน bucket |
| `il1`, `il2`, `il3` | `energy_amp1/2/3` | Last value ใน bucket |
| `pf1`, `pf2`, `pf3` | `energy_pf1/2/3` | Last value ใน bucket |
| `import_kwhr` | `energy_kwh` | Last value ใน bucket |
| fixed value | `status` | `online` |

15-minute aggregation ใช้ row ล่าสุดในแต่ละ `meter_id + 15-minute bucket` สำหรับทุก field โดยเรียง `received_at DESC, id DESC`

## Job 1: 15-Minute Aggregation

ความถี่: ทุก 15 นาที

Input: `meter_data_realtime`

Output: `actual_meter_data`

ช่วงประมวลผล:
- ใช้ bucket เป็นช่วง 15 นาที เช่น `22:00`, `22:15`, `22:30`, `22:45`
- รันย้อนหลังตาม `AGGREGATION_LOOKBACK_MINUTES`
- ไม่ประมวลผล bucket ปัจจุบันที่ยังไม่จบ เช่น job เวลา 10:30:20 ให้ประมวลผลถึง `< 10:30:00`

Pseudo SQL:

```sql
WITH raw AS (
  SELECT
    m.meter_id,
    date_trunc('hour', r.received_at) + floor(extract(minute from r.received_at) / 15) * interval '15 minutes' AS bucket_time,
    r.*,
    row_number() OVER (
      PARTITION BY m.meter_id, 15-minute bucket
      ORDER BY r.received_at DESC
    ) AS latest_rank
  FROM meter_data_realtime r
  JOIN meter m
    ON m.site_id = r.site_id
   AND m.address = r.address_id
  WHERE r.received_at >= :from_time
    AND r.received_at < :to_time
),
agg AS (
  SELECT
    latest.meter_id,
    latest.bucket_time AS date_keep,
    latest.kva_3ph AS energy_kva,
    latest.kw_3ph AS energy_kw,
    latest.kvar_3ph AS energy_kvar,
    latest.hz AS energy_frequency,
    latest.vl1 AS energy_volt_p1,
    latest.vl2 AS energy_volt_p2,
    latest.vl3 AS energy_volt_p3,
    latest.vl12 AS energy_volt_l1,
    latest.vl23 AS energy_volt_l2,
    latest.vl31 AS energy_volt_l3,
    latest.il1 AS energy_amp1,
    latest.il2 AS energy_amp2,
    latest.il3 AS energy_amp3,
    latest.pf1 AS energy_pf1,
    latest.pf2 AS energy_pf2,
    latest.pf3 AS energy_pf3,
    latest.import_kwhr AS energy_kwh
  FROM raw latest
  WHERE latest.latest_rank = 1
)
INSERT INTO actual_meter_data (
  meter_id, date_keep, energy_kva, energy_kw, energy_kvar, energy_frequency,
  energy_volt_p1, energy_volt_p2, energy_volt_p3,
  energy_volt_l1, energy_volt_l2, energy_volt_l3,
  energy_amp1, energy_amp2, energy_amp3,
  energy_pf1, energy_pf2, energy_pf3,
  energy_kwh, status
)
SELECT
  meter_id, date_keep, energy_kva, energy_kw, energy_kvar, energy_frequency,
  energy_volt_p1, energy_volt_p2, energy_volt_p3,
  energy_volt_l1, energy_volt_l2, energy_volt_l3,
  energy_amp1, energy_amp2, energy_amp3,
  energy_pf1, energy_pf2, energy_pf3,
  energy_kwh, 'online'
FROM agg
ON CONFLICT (meter_id, date_keep) DO UPDATE SET
  energy_kva = EXCLUDED.energy_kva,
  energy_kw = EXCLUDED.energy_kw,
  energy_kvar = EXCLUDED.energy_kvar,
  energy_frequency = EXCLUDED.energy_frequency,
  energy_volt_p1 = EXCLUDED.energy_volt_p1,
  energy_volt_p2 = EXCLUDED.energy_volt_p2,
  energy_volt_p3 = EXCLUDED.energy_volt_p3,
  energy_volt_l1 = EXCLUDED.energy_volt_l1,
  energy_volt_l2 = EXCLUDED.energy_volt_l2,
  energy_volt_l3 = EXCLUDED.energy_volt_l3,
  energy_amp1 = EXCLUDED.energy_amp1,
  energy_amp2 = EXCLUDED.energy_amp2,
  energy_amp3 = EXCLUDED.energy_amp3,
  energy_pf1 = EXCLUDED.energy_pf1,
  energy_pf2 = EXCLUDED.energy_pf2,
  energy_pf3 = EXCLUDED.energy_pf3,
  energy_kwh = EXCLUDED.energy_kwh,
  status = EXCLUDED.status;
```

## Job 2: Daily Aggregation

ความถี่: วันละครั้ง ตอน `00:00` เวลาไทย

Input: `actual_meter_data`

Output: `actual_meter_data_daily`

ช่วงประมวลผล:
- ปกติประมวลผลของ “เมื่อวาน” ตาม `AGGREGATION_TIMEZONE`
- รองรับ backfill รายวันย้อนหลังได้

สูตร:
- ใช้แถวล่าสุดของวันจาก `actual_meter_data` ต่อ `meter_id`
- `total_kwh = latest.energy_kwh`
- `max_kw = latest.energy_kw`
- `min_kw = latest.energy_kw`
- `avg_kw = latest.energy_kw`

Pseudo SQL:

```sql
INSERT INTO actual_meter_data_daily (
  meter_id, date_keep, total_kwh, max_kw, min_kw, avg_kw
)
SELECT
  ranked.meter_id,
  (:target_date)::date AS date_keep,
  ranked.energy_kwh AS total_kwh,
  ranked.energy_kw AS max_kw,
  ranked.energy_kw AS min_kw,
  ranked.energy_kw AS avg_kw
FROM (
  SELECT *,
    row_number() OVER (
      PARTITION BY meter_id
      ORDER BY date_keep DESC, id DESC
    ) AS latest_rank
  FROM actual_meter_data
  WHERE date_keep >= :day_start
    AND date_keep < :day_end
) ranked
WHERE ranked.latest_rank = 1
ON CONFLICT (meter_id, date_keep) DO UPDATE SET
  total_kwh = EXCLUDED.total_kwh,
  max_kw = EXCLUDED.max_kw,
  min_kw = EXCLUDED.min_kw,
  avg_kw = EXCLUDED.avg_kw;
```

## Job 3: Monthly Aggregation

ความถี่: เดือนละครั้ง ทุกวันที่ `20` เวลา `00:00` เวลาไทย

Input: `actual_meter_data_daily`

Output: `actual_meter_data_monthly`

ช่วงประมวลผล:
- ปกติประมวลผลเดือนปัจจุบันตามวันที่รัน เช่นวันที่ 20 กรกฎาคม จะเขียน `year_month = 2026-07`
- รองรับ backfill รายเดือนย้อนหลังได้

สูตร:
- ใช้แถวล่าสุดของเดือนจาก `actual_meter_data_daily` ต่อ `meter_id`
- `total_kwh = latest.total_kwh`
- `max_kw = latest.max_kw`
- `avg_kw = latest.avg_kw`
- `year_month = YYYY-MM`

Pseudo SQL:

```sql
INSERT INTO actual_meter_data_monthly (
  meter_id, year_month, total_kwh, max_kw, avg_kw
)
SELECT
  ranked.meter_id,
  :year_month AS year_month,
  ranked.total_kwh,
  ranked.max_kw,
  ranked.avg_kw
FROM (
  SELECT *,
    row_number() OVER (
      PARTITION BY meter_id
      ORDER BY date_keep DESC, id DESC
    ) AS latest_rank
  FROM actual_meter_data_daily
  WHERE date_keep >= :month_start
    AND date_keep < :month_end
) ranked
WHERE ranked.latest_rank = 1
ON CONFLICT (meter_id, year_month) DO UPDATE SET
  total_kwh = EXCLUDED.total_kwh,
  max_kw = EXCLUDED.max_kw,
  avg_kw = EXCLUDED.avg_kw;
```

## Job 4: Realtime Retention Cleanup

ความถี่: วันละครั้ง เช่น `02:30` เวลาไทย

Input/Output: delete จาก `meter_data_realtime`

Policy:
- เก็บล่าสุดตาม `AGGREGATION_RETENTION_MONTHS`
- default = 3 เดือน
- ลบจาก `received_at` ไม่ใช่ `device_datetime` เพื่อให้ policy อิงเวลาที่ระบบรับข้อมูลจริง

Pseudo SQL:

```sql
DELETE FROM meter_data_realtime
WHERE received_at < NOW() - (:retention_months || ' months')::interval;
```

ถ้าข้อมูลเยอะมาก แนะนำลบเป็น batch:

```sql
DELETE FROM meter_data_realtime
WHERE id IN (
  SELECT id
  FROM meter_data_realtime
  WHERE received_at < NOW() - (:retention_months || ' months')::interval
  ORDER BY received_at
  LIMIT 10000
);
```

## Implementation Plan

### Phase 1: Foundation

1. เพิ่ม config variables ใน `backend/src/config`
2. เพิ่ม migration script สำหรับ indexes และ optional `aggregation_job_runs`
3. เพิ่ม service ใหม่ เช่น `backend/src/modules/aggregation/aggregation.service.ts`
4. เพิ่ม helper สำหรับ:
   - คำนวณ 15-minute/day/month bucket ตาม timezone
   - advisory lock
   - insert job run log

### Phase 2: Minute Job

1. สร้าง `aggregateMinuteData(from, to)`
2. Join realtime กับ meter ด้วย `site_id + address_id`
3. Upsert ลง `actual_meter_data`
4. บันทึก rows read/written/skipped
5. เพิ่ม manual script สำหรับ backfill เช่น `npm run aggregation:backfill -- --job minute --from ... --to ...`

### Phase 3: Daily Job

1. สร้าง `aggregateDailyData(targetDate)`
2. อ่านจาก `actual_meter_data`
3. Upsert ลง `actual_meter_data_daily`
4. เพิ่ม backfill รายวัน

### Phase 4: Monthly Job

1. สร้าง `aggregateMonthlyData(yearMonth)`
2. อ่านจาก `actual_meter_data_daily`
3. Upsert ลง `actual_meter_data_monthly`
4. เพิ่ม backfill รายเดือน

### Phase 5: Retention Job

1. สร้าง `cleanupRealtimeData(retentionMonths)`
2. ใช้ batch delete ถ้าข้อมูลเกิน threshold
3. Log จำนวน rows deleted

### Phase 6: Scheduler

ตัวเลือกแนะนำ:

1. ใช้ in-process scheduler ใน backend ด้วย package เช่น `node-cron`
   - ติดตั้งง่าย
   - ต้องใช้ advisory lock เพราะ production อาจมีหลาย instance

2. ใช้ external scheduler ของ Railway/Cron service เรียก command/API
   - เหมาะกับ production มากกว่า
   - ลดความเสี่ยง job ซ้อนกับ web server

แนะนำเริ่มจาก `node-cron` + advisory lock เพื่อเร็วที่สุด แล้วค่อยแยกเป็น worker service เมื่อระบบใหญ่ขึ้น

## Files ที่คาดว่าจะเพิ่ม/แก้

```text
backend/src/config/aggregation.ts
backend/src/modules/aggregation/aggregation.service.ts
backend/src/modules/aggregation/aggregation.scheduler.ts
backend/src/scripts/add-aggregation-indexes.ts
backend/src/scripts/backfill-aggregation.ts
backend/src/server.ts
backend/package.json
backend/.env
```

ถ้าเพิ่ม `node-cron`:

```text
backend/package.json
backend/package-lock.json
```

## API/Frontend Impact

### หลังทำ 15-Minute Job

- `/meter-data/realtime` จะเริ่มมีข้อมูล เพราะ API อ่าน latest จาก `actual_meter_data`
- `/meter-data/history` จะเริ่มมีข้อมูลย้อนหลังระดับ 15 นาที
- Dashboard ที่อ่าน `actual_meter_data` จะไม่ว่าง

### หลังทำ Daily/Monthly Job

ปัจจุบัน `MeterDataService.getDailyData()` และ `getMonthlyData()` ยัง aggregate จาก `actual_meter_data` โดยตรง ไม่ได้อ่าน `actual_meter_data_daily/monthly`

ทางเลือก:

1. คง API เดิมไว้ แล้วใช้ daily/monthly table สำหรับ report/export ภายหลัง
2. ปรับ API daily/monthly ให้อ่านจาก aggregate table เพื่อ query เร็วขึ้น

แนะนำทำข้อ 1 ก่อนเพื่อไม่กระทบ frontend แล้วค่อย optimize API ใน phase ถัดไป

## Testing Plan

1. Unit test การคำนวณ bucket timezone
2. Integration test ด้วย sample rows:
   - realtime หลายแถวใน 1 นาที ต้องได้ 1 row ต่อ meter
   - rerun 15-minute job ต้อง update ไม่ duplicate
   - missing meter mapping ต้อง skip
   - daily snapshot ใช้ row ล่าสุดของวัน
   - monthly snapshot ใช้ row ล่าสุดของเดือนจาก daily table
3. Backfill test:
   - backfill 1 ชั่วโมง
   - backfill 1 วัน
   - backfill 1 เดือน
4. Cleanup dry-run:
   - count rows ที่จะลบก่อน delete
   - delete batch แล้วตรวจจำนวนคงเหลือ

## Rollout Plan

1. Deploy migration indexes ก่อน
2. เพิ่ม mapping ใน `realtime_meter_map` ให้ครบก่อน โดยเฉพาะ channel/site/address ที่มาจาก Redis
3. Enable 15-minute job ด้วย lookback 30 นาที
4. Run backfill จาก `meter_data_realtime` ย้อนหลังเท่าที่ต้องการ เช่น 7 วัน หรือ 3 เดือน
5. เปิด daily job และ backfill daily จาก `actual_meter_data`
6. เปิด monthly job และ backfill monthly จาก `actual_meter_data_daily`
7. เปิด retention cleanup หลังยืนยันว่า aggregate ครบแล้ว
8. Monitor job logs 24-48 ชั่วโมง

## Commands

เตรียม schema/index/job log/mapping table:

```bash
npm run aggregation:setup
```

Backfill ราย 15-minute:

```bash
npm run aggregation:backfill -- --job minute --from 2026-07-04T00:00:00Z --to 2026-07-04T01:00:00Z
```

Backfill รายวัน:

```bash
npm run aggregation:backfill -- --job daily --date 2026-07-04
```

Backfill รายเดือน:

```bash
npm run aggregation:backfill -- --job monthly --month 2026-07
```

รัน cleanup ตาม retention:

```bash
npm run aggregation:backfill -- --job retention --months 3
```

## Risks / Decisions Needed

| เรื่อง | Decision ที่ต้องเลือก |
|---|---|
| Daily target table | ใช้ `actual_meter_data_daily` ตาม schema ปัจจุบัน |
| ค่าใน 15-minute bucket | ใช้ Last row ทุก field ในแต่ละ bucket โดยเรียง `received_at DESC, id DESC` |
| Timezone | ใช้ `Asia/Bangkok` เป็น business timezone |
| Missing meter mapping | Skip + log หรือ auto-create meter |
| Deployment style | `node-cron` ใน backend หรือแยก worker/external scheduler |

## Acceptance Criteria

- `actual_meter_data` มีไม่เกิน 1 row ต่อ `meter_id + 15-minute bucket`
- `actual_meter_data_daily` มีไม่เกิน 1 row ต่อ `meter_id + date`
- `actual_meter_data_monthly` มีไม่เกิน 1 row ต่อ `meter_id + year_month`
- รัน job ซ้ำไม่เกิด duplicate rows
- API realtime/history เริ่มแสดงข้อมูลจาก `actual_meter_data`
- retention cleanup ลบเฉพาะข้อมูล `meter_data_realtime` ที่เก่ากว่า config
- เปลี่ยน `AGGREGATION_RETENTION_MONTHS` แล้ว cleanup ใช้ค่าใหม่โดยไม่ต้องแก้ code
