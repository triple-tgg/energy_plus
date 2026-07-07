# Database Table Summary

สำรวจจาก PostgreSQL Railway ณ `2026-07-07` และตรวจ usage จาก source code ใน `backend/src` / `frontend/src`.

หมายเหตุ:
- `Rows` คือจำนวนข้อมูลจริงใน database ตอนสำรวจ
- `Runtime used` หมายถึงมีการอ้างถึง table ใน backend runtime code ไม่รวม migration/seed scripts
- `No runtime usage` หมายถึงพบแค่ใน scripts/docs หรือไม่พบใน code runtime
- ตาราง `real_time_data` ไม่มีใน database นี้; realtime table ที่มีจริงคือ `meter_data_realtime`
- ตาราง `aggregation_job_runs` และ `realtime_meter_map` ถูกนับรวมใน inventory แล้ว (ใช้จริงใน aggregation job runtime)

## Data Change Log

- `2026-07-07`: ลบข้อมูล meter data ออกทั้งหมด — `TRUNCATE` ตาราง `meter_data_realtime`, `actual_meter_data`, `actual_meter_data_daily`, `actual_meter_data_monthly` (realtime กลับมามีข้อมูลใหม่จาก pipeline หลังจากนั้น)
- `2026-07-07`: ลบ meter ที่ `is_active = false` ออก 117 แถว เหลือ meter ที่ active 4 แถวในตาราง `meter`

## Executive Summary

| กลุ่ม | จำนวน |
|---|---:|
| Tables ทั้งหมด | 35 |
| Tables ที่มีข้อมูล | 22 |
| Tables ที่ยังไม่มีข้อมูล | 13 |
| Tables ที่ runtime code ใช้งาน | 25 |
| Tables ที่ยังไม่ถูกใช้งานใน runtime code | 10 |

## Tables ที่มีข้อมูลแล้ว

| Table | Rows | สถานะการใช้งาน |
|---|---:|---|
| `aggregation_job_runs` | 2,943 | ใช้ใน runtime เก็บผลการรัน aggregation job แต่ละรอบ |
| `alarm_group` | 6 | ใช้ใน runtime |
| `app_user` | 5 | ใช้ใน runtime |
| `billing_config` | 8 | ใช้ใน runtime |
| `buildings` | 12 | ใช้ใน runtime |
| `company` | 2 | ใช้ใน runtime |
| `demand_peak_config` | 4 | ใช้ใน runtime |
| `energy_value` | 42 | ใช้ใน runtime |
| `group_user` | 12 | ใช้ใน runtime |
| `layout_points` | 4 | ใช้ใน runtime |
| `layouts` | 6 | ใช้ใน runtime |
| `loop` | 16 | ใช้ใน runtime |
| `meter` | 4 | ใช้ใน runtime (เหลือเฉพาะ meter ที่ active) |
| `meter_brand` | 19 | ใช้ใน runtime |
| `meter_data_realtime` | 355 | ใช้ใน runtime; ไหลเข้าใหม่จาก Redis/PubSub หลัง truncate |
| `meter_type` | 4 | ใช้ใน runtime |
| `protocol` | 6 | master data (ไม่ถูก query ตรงใน runtime) |
| `realtime_meter_map` | 8 | ใช้ใน aggregation job runtime |
| `site_user_map` | 13 | ใช้ใน runtime |
| `sites` | 7 | ใช้ใน runtime |
| `user_permission` | 20 | ใช้ใน runtime |
| `zones` | 32 | ใช้ใน runtime |

## Tables ที่ยังไม่มีข้อมูล

| Table | Rows | สถานะการใช้งาน |
|---|---:|---|
| `actual_meter_data` | 0 | ใช้ใน runtime (15-minute snapshot); ว่างหลัง truncate `2026-07-07` |
| `actual_meter_data_daily` | 0 | ใช้ใน runtime (daily snapshot); ว่างหลัง truncate `2026-07-07` |
| `actual_meter_data_monthly` | 0 | ใช้ใน runtime (monthly snapshot); ว่างหลัง truncate `2026-07-07` |
| `alarm_config` | 0 | ใช้ใน runtime แต่ไม่มีข้อมูล |
| `alarm_group_mapping` | 0 | ไม่มี runtime usage |
| `auditlogs` | 0 | ไม่มี runtime usage |
| `demand_meter_config` | 0 | ไม่มี runtime usage |
| `demand_peak_data` | 0 | ไม่มี runtime usage |
| `energy_daily_usage` | 0 | ไม่มี runtime usage |
| `energy_save` | 0 | ไม่มี runtime usage |
| `refresh_tokens` | 0 | ไม่มี runtime usage |
| `saving_meter_config` | 0 | ไม่มี runtime usage |
| `write_log` | 0 | ไม่มี runtime usage |

## Tables ที่ยังไม่ถูกใช้งานใน Runtime Code

| Table | Rows | หมายเหตุ |
|---|---:|---|
| `alarm_group_mapping` | 0 | มี schema แต่ alarm runtime ยังไม่ได้ใช้ mapping table |
| `auditlogs` | 0 | ยังไม่มี audit logger เขียน/อ่าน table นี้ |
| `demand_meter_config` | 0 | มี config schema แต่ runtime billing/demand ยังไม่ได้ใช้ mapping table |
| `demand_peak_data` | 0 | ยังไม่มี process เก็บ demand peak actual data |
| `energy_daily_usage` | 0 | ยังไม่มี job/API เก็บ usage รายวัน |
| `energy_save` | 0 | ยังไม่มี job/API เก็บผลประหยัดพลังงาน |
| `protocol` | 6 | เป็น master data แต่ runtime meter service ยังไม่ได้ query ตรง |
| `refresh_tokens` | 0 | auth ปัจจุบันใช้ JWT access token ยังไม่ใช้ refresh token table |
| `saving_meter_config` | 0 | ยังไม่มี runtime usage |
| `write_log` | 0 | ยังไม่มี runtime logging สำหรับ write command |

## Full Table Inventory

| Table | Rows | เก็บข้อมูลอะไร | Runtime used |
|---|---:|---|---|
| `actual_meter_data` | 0 | ข้อมูล 15-minute snapshot แบบ latest row ทุก field ต่อ `meter_id + date_keep` | Yes |
| `actual_meter_data_daily` | 0 | ข้อมูล snapshot รายวันจาก `actual_meter_data` โดยเก็บแถวล่าสุดของวัน | Yes |
| `actual_meter_data_monthly` | 0 | ข้อมูล snapshot รายเดือนจาก `actual_meter_data_daily` โดยเก็บแถวล่าสุดของเดือน | Yes |
| `aggregation_job_runs` | 2,943 | บันทึกผลการรัน aggregation job แต่ละรอบ เช่น ช่วงเวลา, สถานะ, จำนวนแถวที่ประมวลผล | Yes |
| `alarm_config` | 0 | เงื่อนไข alarm ต่อ meter/energy value เช่น lower/higher threshold, message, lamp/buzzer | Yes |
| `alarm_group` | 6 | กลุ่มผู้รับ alarm เช่น email, telegram token/chat id, active flag | Yes |
| `alarm_group_mapping` | 0 | mapping ระหว่าง alarm group กับ meter | No |
| `app_user` | 5 | ผู้ใช้งานระบบ, email, password hash, group, active status | Yes |
| `auditlogs` | 0 | log การกระทำของ user ต่อ entity พร้อม old/new values และ IP | No |
| `billing_config` | 8 | ค่าไฟ/อัตราคิดเงินตาม effective date, unit price, active flag | Yes |
| `buildings` | 12 | อาคารภายใต้ site | Yes |
| `company` | 2 | ข้อมูลบริษัท เช่น ชื่อ, address, contact, domain, logo | Yes |
| `demand_meter_config` | 0 | mapping meter ที่ใช้กับ demand peak config | No |
| `demand_peak_config` | 4 | config demand peak เช่น warning/peak setpoint, saving rate, flat rate, TOU | Yes |
| `demand_peak_data` | 0 | ค่า demand ที่เกิดขึ้นจริงตามเวลา และ flag ว่าเป็น peak หรือไม่ | No |
| `energy_daily_usage` | 0 | usage รายวันจาก start/end kWh, unit price และ amount | No |
| `energy_save` | 0 | ผลการประหยัดพลังงานเทียบ target/actual | No |
| `energy_value` | 42 | master list ของค่าพลังงาน/คอลัมน์ เช่น kW, kWh, voltage, current, unit, display order | Yes |
| `group_user` | 12 | กลุ่ม/role ผู้ใช้ เช่น admin/technician พร้อมคำอธิบาย | Yes |
| `layout_points` | 4 | จุดบน layout/floor plan เช่น point type, label, position %, linked meter, config JSON | Yes |
| `layouts` | 6 | layout/floor plan พร้อมชื่อ รูปภาพ ตำแหน่ง และ URL | Yes |
| `loop` | 16 | master/config loop หรือ communication line เช่น port, baudrate | Yes |
| `meter` | 4 | master data มิเตอร์ เช่น code/name/address/site/building/zone/protocol/room/status/phase/circuit (เหลือเฉพาะ active) | Yes |
| `meter_brand` | 19 | master ยี่ห้อ/รุ่นมิเตอร์ | Yes |
| `meter_data_realtime` | 355 | ข้อมูล realtime จาก Redis/PubSub เช่น voltage/current/power/PF/Hz/import kWh, device_datetime, received_at, raw JSON | Yes |
| `meter_type` | 4 | master ประเภทมิเตอร์ เช่น electricity/water/gas พร้อม icon | Yes |
| `protocol` | 6 | master protocol เช่น Modbus RTU/TCP/BACnet | No |
| `realtime_meter_map` | 8 | mapping ระหว่าง realtime source (site/address) กับ meter_id สำหรับ aggregation | Yes |
| `refresh_tokens` | 0 | token สำหรับ refresh session/login | No |
| `saving_meter_config` | 0 | mapping/config สำหรับ meter ที่ใช้คำนวณ saving พร้อม baseline kWh | No |
| `site_user_map` | 13 | mapping สิทธิ์ user กับ site | Yes |
| `sites` | 7 | site/project/location พร้อม address/status/lat/long | Yes |
| `user_permission` | 20 | permission ราย group เช่น can_view/create/edit/delete ต่อ module key | Yes |
| `write_log` | 0 | log การสั่งเขียน/command ไปยัง meter/device | No |
| `zones` | 32 | zone/area ภายใต้ building และ flag แสดง dashboard | Yes |

## Runtime Usage Map

| Table | Runtime files |
|---|---|
| `actual_meter_data` | `dashboard.service.ts`, `meterData.service.ts`, `meters.service.ts` |
| `actual_meter_data_daily` | `aggregation.service.ts`, `aggregation.scheduler.ts`, `test-aggregation.ts` |
| `actual_meter_data_monthly` | `aggregation.service.ts`, `aggregation.scheduler.ts`, `test-aggregation.ts` |
| `aggregation_job_runs` | `aggregation.service.ts`, `aggregation.scheduler.ts`, `backfill-aggregation.ts` |
| `alarm_config` | `alarms.service.ts` |
| `alarm_group` | `alarms.service.ts` |
| `app_user` | `auth.service.ts`, `sites.service.ts`, `users.service.ts` |
| `billing_config` | `billing.service.ts` |
| `buildings` | `meterData.service.ts`, `meters.service.ts`, `sites.routes.ts`, `sites.service.ts` |
| `company` | `company.controller.ts`, `company.routes.ts`, `company.service.ts`, `server.ts` |
| `demand_peak_config` | `billing.service.ts` |
| `energy_value` | `alarms.service.ts`, `meters.service.ts` |
| `group_user` | `auth.service.ts`, `users.service.ts` |
| `layout_points` | `layouts.service.ts` |
| `layouts` | `layouts.controller.ts`, `layouts.routes.ts`, `layouts.service.ts`, `server.ts` |
| `loop` | `meters.service.ts` |
| `meter` | `alarms.service.ts`, `dashboard.service.ts`, `layouts.service.ts`, `meterData.service.ts`, `meters.service.ts`, `redisPubsub.service.ts`, `sites.service.ts`, `server.ts` |
| `meter_brand` | `meters.service.ts` |
| `meter_data_realtime` | `redisPubsub.service.ts` |
| `meter_type` | `meters.service.ts` |
| `realtime_meter_map` | `aggregation.service.ts`, `backfill-aggregation.ts`, `test-aggregation.ts` |
| `site_user_map` | `auth.service.ts`, `sites.service.ts` |
| `sites` | `auth.service.ts`, `meters.service.ts`, `sites.controller.ts`, `sites.routes.ts`, `sites.service.ts`, `server.ts`, `types/index.ts` |
| `user_permission` | `auth.service.ts`, `users.service.ts` |
| `zones` | `dashboard.service.ts`, `meterData.service.ts`, `meters.service.ts`, `sites.routes.ts`, `sites.service.ts` |

## Observations

1. Realtime data currently flows into `meter_data_realtime`, not `actual_meter_data`.
2. Reporting/history APIs อ่านจาก 15-minute snapshots ใน `actual_meter_data`; หลัง truncate `2026-07-07` ตารางนี้ว่างและจะถูก populate ใหม่โดย aggregation job.
3. Daily/monthly aggregate tables ถูก populate โดย aggregation job และเป็นส่วนหนึ่งของ runtime; ตอนนี้ว่างหลัง truncate.
4. Several feature tables look planned but not active yet: audit logs, refresh tokens, demand peak actual data, energy saving, write logs.
5. `protocol` has master data but is not directly queried by runtime code; meter records do have `protocol_id`, so this may be intended for future detail joins.
6. `meter` เหลือเฉพาะ meter ที่ `is_active = true` (4 แถว) หลังลบ inactive meters `2026-07-07`.
