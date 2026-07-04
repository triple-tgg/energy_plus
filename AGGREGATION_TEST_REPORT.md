# Aggregation Test Report

วันที่ทดสอบ: `2026-07-04`

## Scope

ทดสอบระบบ aggregation job ที่สรุปข้อมูลจาก `meter_data_realtime` ไปยัง:

- `actual_meter_data` ระดับ 15 นาที
- `actual_meter_data_daily` ระดับรายวัน
- `actual_meter_data_monthly` ระดับรายเดือน
- retention dry-run สำหรับลบ raw realtime data เก่ากว่า config

การทดสอบใช้ production PostgreSQL Railway แต่ส่วน integration test ที่เขียนข้อมูลใช้ transaction และ `ROLLBACK` เพื่อไม่ทิ้งข้อมูลทดสอบไว้ใน database

## Commands

```bash
npm run build
npm run aggregation:test
```

## Build Result

| Test | Result |
|---|---|
| TypeScript build | PASS |

Command:

```bash
npm run build
```

ผลลัพธ์: `tsc` ผ่าน ไม่มี TypeScript error

## Integration Test Result

| Test | Result | Details |
|---|---|---|
| Schema setup | PASS | indexes, `aggregation_job_runs`, `realtime_meter_map` พร้อมใช้งาน |
| Required tables exist | PASS | พบ `aggregation_job_runs`, `realtime_meter_map` |
| Realtime source available | PASS | พบข้อมูลจาก `project1_1000_1`, `site_id=1000`, `address_id=1` |
| Meter master available | PASS | ใช้ meter ทดสอบ `meter_id=31`, `meter_code=2001213885` |
| 15-minute aggregation | PASS | อ่าน raw realtime `95` rows และเขียนได้ `1` 15-minute snapshot โดยใช้ Last row ทุก field |
| Daily aggregation | PASS | อ่าน `1` meter/day และเขียนได้ `1` daily snapshot จากแถวล่าสุดของวัน |
| Monthly aggregation | PASS | อ่าน `1` meter/month และเขียนได้ `1` monthly snapshot จากแถวล่าสุดของเดือน |
| Retention dry-run | PASS | พบข้อมูลเก่ากว่า config 3 เดือนจำนวน `9,665` rows |
| Rollback cleanup | PASS | ข้อมูล mapping/aggregate ที่ใช้ทดสอบไม่ถูก persist |

## Test Data Used

Realtime source ล่าสุดที่ใช้ทดสอบ:

| Field | Value |
|---|---|
| `channel` | `project1_1000_1` |
| `site_id` | `1000` |
| `address_id` | `1` |
| `to_time` | `2026-07-04T16:56:00.000Z` |

Temporary mapping ใน transaction:

| Field | Value |
|---|---|
| `channel` | `project1_1000_1` |
| `realtime_site_id` | `1000` |
| `realtime_address_id` | `1` |
| `meter_id` | `31` |

ช่วง 15-minute aggregation ที่ทดสอบ:

| Field | Value |
|---|---|
| From | `2026-07-04T17:05:00.000Z` |
| To | `2026-07-04T17:15:00.000Z` |
| Raw rows read | `95` |
| Snapshot rows written | `1` |
| Summary mode | Last row every field, ordered by `received_at DESC, id DESC` |

## Database State After Test

ตรวจหลัง rollback:

| Table | Rows |
|---|---:|
| `realtime_meter_map` | 0 |
| `actual_meter_data` | 0 |
| `actual_meter_data_daily` | 0 |
| `actual_meter_data_monthly` | 0 |
| `aggregation_job_runs` | มี log จริงจาก scheduler/backfill |

หมายเหตุ: `aggregation_job_runs` เป็น log การรัน job จริง/backfill ก่อนหน้า ไม่ใช่ aggregate data จาก integration rollback test รอบนี้

## Findings

1. Aggregation logic ทำงานได้เมื่อมี mapping จาก realtime source ไปยัง `meter_id`
2. 15-minute aggregation ใช้ Last row ทุก field ในแต่ละ 15-minute bucket แล้ว ไม่ใช้ AVG สำหรับ realtime snapshot
3. Daily aggregation ใช้ Last row ของวันจาก `actual_meter_data`
4. Monthly aggregation ใช้ Last row ของเดือนจาก `actual_meter_data_daily`
5. Monthly scheduler ถูกตั้งให้รันทุกวันที่ 20 เวลา `00:00` เวลาไทย และเขียน `year_month` ของเดือนปัจจุบัน
6. ข้อมูล realtime ปัจจุบัน (`site_id=1000`, `address_id=1`) ยังไม่มี mapping จริงใน `realtime_meter_map`
7. หากเปิด scheduler ตอนนี้โดยยังไม่เพิ่ม mapping, job จะ skip ข้อมูล realtime ปัจจุบันและ `actual_meter_data` จะยังไม่มีข้อมูล
8. Retention พบข้อมูลเก่ากว่า 3 เดือน `9,670` rows แต่ยังไม่ได้ลบ เพราะทดสอบแบบ dry-run

## Next Step Before Enabling Jobs

ต้องเพิ่ม mapping จริงก่อน เช่น:

```sql
INSERT INTO realtime_meter_map (
  channel, realtime_site_id, realtime_address_id, meter_id
)
VALUES (
  'project1_1000_1', 1000, 1, <meter_id จริงที่ต้องการ>
);
```

หลังจาก mapping ถูกต้องแล้วจึงค่อย:

1. รัน backfill 15-minute จริง
2. รัน daily/monthly backfill
3. ตั้ง `AGGREGATION_ENABLED=true`
4. เปิด retention cleanup หลังยืนยันว่า aggregate ครบแล้ว
