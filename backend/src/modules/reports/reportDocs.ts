import { Request, Response } from 'express';

// OpenAPI 3.0 Document dedicated specifically to Report APIs
export const reportOpenApiDocument: any = {
    openapi: '3.0.3',
    info: {
        title: 'EnergyPlus - Report Data Extraction API',
        version: '1.0.2',
        description: `
### เอกสารข้อกำหนด API สำหรับการดึงข้อมูลรายงาน (Report API Specification)

API ชุดนี้จัดทำขึ้นเพื่อให้ระบบภายนอก (Third-party System, ERP, BI Tools, ลูกค้า) สามารถเชื่อมต่อเพื่อดึงข้อมูลรายงานการใช้พลังงาน, ค่าไฟฟ้าตามอัตรา TOU, และข้อมูลดิบย้อนหลังของมิเตอร์ไปประมวลผลต่อได้

---
### 🔐 ขั้นตอนการยืนยันตัวตน (Authentication Guide)

1. **ขอ Access Token**:
   - ยิงคำขอไปยัง \`POST /api/v1/auth/login\`
   - Body: \`{ "username": "<your_username>", "password": "<your_password>" }\`
   - ระบบจะส่งคืน \`accessToken\` (JWT Token)

2. **แนบ Token ในทุกคำขอ (Header)**:
   - \`Authorization: Bearer <accessToken>\`
   - \`Content-Type: application/json\`

3. **การจำกัดสิทธิ์ข้อมูล (Data Scope / Site Access)**:
   - ผู้ใช้ที่ได้รับสิทธิ์เฉพาะไซต์ (\`assigned\`) จะได้รับข้อมูลเฉพาะไซต์ที่ได้รับอนุญาตโดยอัตโนมัติ
        `,
        contact: {
            name: 'EnergyPlus Engineering & Support',
        },
    },
    servers: [
        {
            url: '/api/v1',
            description: 'API v1 Base Endpoint',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'ใส่ Access Token ที่ได้รับจาก POST /api/v1/auth/login',
            },
        },
        schemas: {
            ApiResponsePagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 10 },
                    total: { type: 'integer', example: 45 },
                    totalPages: { type: 'integer', example: 5 },
                },
            },
            EnergyConsumptionItem: {
                type: 'object',
                properties: {
                    meter_id: { type: 'integer', example: 101 },
                    meter_code: { type: 'string', example: 'MTR-FL1-01' },
                    meter_name: { type: 'string', example: 'Main Incomer 1' },
                    building_name: { type: 'string', example: 'Building A' },
                    zone_name: { type: 'string', example: 'Floor 1 Main' },
                    project_name: { type: 'string', example: 'Bangkok Head Office' },
                    first_reading: { type: 'number', example: 125430.50, description: 'เลขมิเตอร์ ณ วันเริ่มต้น (kWh)' },
                    last_reading: { type: 'number', example: 128920.80, description: 'เลขมิเตอร์ ณ วันสิ้นสุด (kWh)' },
                    diff_reading: { type: 'number', example: 3490.30, description: 'หน่วยการใช้ไฟฟ้าที่คำนวณได้ (kWh)' },
                    total_kwh: { type: 'number', example: 3490.30, description: 'หน่วยรวม (kWh)' },
                    multiplier: { type: 'number', example: 1.0 },
                    peak_kw: { type: 'number', example: 145.20, description: 'Peak Demand สูงสุดในช่วงเวลา (kW)' },
                    cost: { type: 'number', example: 15706.35, description: 'ประมาณการค่าไฟ (บาท)' },
                },
            },
            TouReportItem: {
                type: 'object',
                properties: {
                    meter_id: { type: 'integer', example: 101 },
                    meter_code: { type: 'string', example: 'MTR-FL1-01' },
                    customer_name: { type: 'string', example: 'Production Line 1' },
                    site_name: { type: 'string', example: 'Factory 1' },
                    building_name: { type: 'string', example: 'Building Main' },
                    start_reading: { type: 'number', example: 50400.2 },
                    end_reading: { type: 'number', example: 54100.8 },
                    total_kwh: { type: 'number', example: 3700.6, description: 'หน่วยไฟฟ้ารวม (kWh)' },
                    on_peak_kwh: { type: 'number', example: 2100.4, description: 'หน่วย On-Peak (จ.-ศ. 09:00 - 22:00)' },
                    off_peak_kwh: { type: 'number', example: 1100.2, description: 'หน่วย Off-Peak (จ.-ศ. 22:00 - 09:00)' },
                    holiday_kwh: { type: 'number', example: 500.0, description: 'หน่วยวันหยุด เสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์' },
                    max_kw: { type: 'number', example: 185.50, description: 'Peak Demand สูงสุด (kW)' },
                    on_peak_cost: { type: 'number', example: 12178.52 },
                    off_peak_cost: { type: 'number', example: 2901.12 },
                    holiday_cost: { type: 'number', example: 1318.45 },
                    demand_cost: { type: 'number', example: 38955.00 },
                    ft_cost: { type: 'number', example: 600.61 },
                    service_charge: { type: 'number', example: 38.22 },
                    vat_amount: { type: 'number', example: 3919.43 },
                    total_cost: { type: 'number', example: 59911.35, description: 'รวมยอดค่าไฟฟ้าสุทธิ (บาท)' },
                },
            },
            HistoryRecordItem: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 598412 },
                    meter_id: { type: 'integer', example: 101 },
                    meter_code: { type: 'string', example: 'MTR-FL1-01' },
                    meter_name: { type: 'string', example: 'Main Incomer 1' },
                    date_keep: { type: 'string', format: 'date-time', example: '2026-10-18T10:15:00.000Z' },
                    energy_kwh: { type: 'number', example: 128920.80 },
                    energy_kw: { type: 'number', example: 124.50 },
                    energy_kvar: { type: 'number', example: 35.20 },
                    energy_volt_l1: { type: 'number', example: 231.4 },
                    energy_volt_l2: { type: 'number', example: 230.8 },
                    energy_volt_l3: { type: 'number', example: 231.0 },
                    energy_amp1: { type: 'number', example: 180.2 },
                    energy_amp2: { type: 'number', example: 179.5 },
                    energy_amp3: { type: 'number', example: 181.0 },
                    energy_pf1: { type: 'number', example: 0.95 },
                    energy_pf2: { type: 'number', example: 0.94 },
                    energy_pf3: { type: 'number', example: 0.95 },
                    energy_frequency: { type: 'number', example: 50.01 },
                },
            },
        },
    },
    security: [
        {
            bearerAuth: [],
        },
    ],
    paths: {
        '/auth/login': {
            post: {
                tags: ['1. Authentication'],
                summary: 'เข้าสู่ระบบเพื่อขอรับ Access Token (JWT)',
                description: 'ใช้สำหรับส่ง Username / Password เพื่อรับ accessToken สำหรับนำไปแนบใน Header `Authorization: Bearer <token>`',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['username', 'password'],
                                properties: {
                                    username: { type: 'string', example: 'api_client' },
                                    password: { type: 'string', example: 'password123' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'เข้าสู่ระบบสำเร็จ',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
                                                refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
                                                expiresIn: { type: 'integer', example: 86400 },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
                },
            },
        },
        '/reports/energy-consumption': {
            get: {
                tags: ['2. Energy Reports'],
                summary: 'ดึงรายงานการใช้พลังงานรวม (Energy Consumption Report)',
                description: 'ดึงข้อมูลหน่วยการใช้ไฟฟ้า (kWh), ค่าไฟ, Peak Demand และเลขมิเตอร์เริ่มต้น-สิ้นสุด ตามช่วงวันที่และเงื่อนไขที่กำหนด',
                parameters: [
                    { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-10-01', description: 'วันที่เริ่มต้น (YYYY-MM-DD)' },
                    { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-10-18', description: 'วันที่สิ้นสุด (YYYY-MM-DD)' },
                    { name: 'siteId', in: 'query', schema: { type: 'integer' }, description: 'รหัสไซต์/สาขา (หากไม่ระบุจะดึงตามสิทธิ์ผู้ใช้งาน)' },
                    { name: 'buildingId', in: 'query', schema: { type: 'integer' }, description: 'รหัสอาคาร' },
                    { name: 'zoneId', in: 'query', schema: { type: 'integer' }, description: 'รหัสโซน' },
                    { name: 'meterTypeId', in: 'query', schema: { type: 'integer' }, description: 'รหัสประเภทมิเตอร์ (เช่น ไฟฟ้า, น้ำ, แก๊ส)' },
                    { name: 'meterId', in: 'query', schema: { type: 'integer' }, description: 'รหัสมิเตอร์เฉพาะตัว' },
                    { name: 'search', in: 'query', schema: { type: 'string' }, description: 'คำค้นหารหัสหรือชื่อมิเตอร์' },
                    { name: 'mdb', in: 'query', schema: { type: 'string', enum: ['exclude', 'only'] }, description: 'exclude: ไม่เอามิเตอร์ MDB, only: เอาเฉพาะมิเตอร์ MDB' },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'หน้าปัจจุบัน' },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 }, description: 'จำนวนรายการต่อหน้า (สูงสุด 1000)' },
                ],
                responses: {
                    200: {
                        description: 'ดึงข้อมูลสำเร็จ',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/EnergyConsumptionItem' },
                                        },
                                        pagination: { $ref: '#/components/schemas/ApiResponsePagination' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/reports/tou': {
            get: {
                tags: ['2. Energy Reports'],
                summary: 'ดึงรายงานค่าไฟฟ้าตามอัตรา TOU (Time of Use Report)',
                description: 'คำนวณและสรุปหน่วยการใช้ไฟฟ้าแยกตามช่วงเวลา On-Peak, Off-Peak, Holiday และค่าไฟฟ้าสุทธิ (รวม Ft, Demand, ค่าบริการ และ VAT)',
                parameters: [
                    { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-10-01', description: 'วันที่เริ่มต้น (YYYY-MM-DD)' },
                    { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-10-18', description: 'วันที่สิ้นสุด (YYYY-MM-DD)' },
                    { name: 'siteId', in: 'query', schema: { type: 'integer' }, description: 'รหัสไซต์' },
                    { name: 'buildingId', in: 'query', schema: { type: 'integer' }, description: 'รหัสอาคาร' },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                ],
                responses: {
                    200: {
                        description: 'ดึงข้อมูลสำเร็จ',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/TouReportItem' },
                                        },
                                        pagination: { $ref: '#/components/schemas/ApiResponsePagination' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/reports/energy-monthly': {
            get: {
                tags: ['2. Energy Reports'],
                summary: 'ดึงรายงานการใช้พลังงานและค่าไฟฟ้ารายเดือน (Monthly Energy Report)',
                description: 'สรุปหน่วยการใช้ไฟฟ้าและค่าไฟฟ้ารายเดือนตลอดทั้งปี หรือเฉพาะเดือนที่ต้องการ',
                parameters: [
                    { name: 'year', in: 'query', schema: { type: 'integer' }, example: 2026, description: 'ปี ค.ศ. (เช่น 2026)' },
                    { name: 'month', in: 'query', schema: { type: 'integer' }, example: 10, description: 'เดือน 1-12 (ไม่ระบุ = ดึงทุกเดือน)' },
                    { name: 'siteId', in: 'query', schema: { type: 'integer' }, description: 'รหัสไซต์' },
                    { name: 'buildingId', in: 'query', schema: { type: 'integer' }, description: 'รหัสอาคาร' },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 12 } },
                ],
                responses: {
                    200: { description: 'ดึงข้อมูลสำเร็จ' },
                },
            },
        },
        '/reports/tou-monthly': {
            get: {
                tags: ['2. Energy Reports'],
                summary: 'ดึงรายงาน TOU แยกรายเดือน (Monthly TOU Report)',
                description: 'สรุปการใช้พลังงานและค่าไฟฟ้าแบบ Time-of-Use แยกเป็นรายเดือน',
                parameters: [
                    { name: 'year', in: 'query', schema: { type: 'integer' }, example: 2026 },
                    { name: 'month', in: 'query', schema: { type: 'integer' }, example: 10 },
                    { name: 'siteId', in: 'query', schema: { type: 'integer' } },
                    { name: 'buildingId', in: 'query', schema: { type: 'integer' } },
                ],
                responses: {
                    200: { description: 'ดึงข้อมูลสำเร็จ' },
                },
            },
        },
        '/reports/history': {
            get: {
                tags: ['3. Raw & Historical Data'],
                summary: 'ดึงบันทึกข้อมูลย้อนหลังของมิเตอร์ (Historical Interval Data)',
                description: 'ดึงข้อมูลค่ากระแสไฟฟ้า แรงดัน กำลังไฟฟ้า และหน่วยสะสม ทุกรอบการบันทึก (interval log)',
                parameters: [
                    { name: 'meterId', in: 'query', schema: { type: 'integer' }, description: 'รหัสมิเตอร์' },
                    { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-10-18' },
                    { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-10-18' },
                    { name: 'siteId', in: 'query', schema: { type: 'integer' } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
                ],
                responses: {
                    200: {
                        description: 'ดึงข้อมูลสำเร็จ',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/HistoryRecordItem' },
                                        },
                                        pagination: { $ref: '#/components/schemas/ApiResponsePagination' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/meter-data/daily': {
            get: {
                tags: ['3. Raw & Historical Data'],
                summary: 'ดึงข้อมูลการใช้พลังงานสรุปรายวัน (Daily Aggregated Data)',
                parameters: [
                    { name: 'siteId', in: 'query', schema: { type: 'integer' } },
                    { name: 'startDate', in: 'query', schema: { type: 'string' }, example: '2026-10-01' },
                    { name: 'endDate', in: 'query', schema: { type: 'string' }, example: '2026-10-18' },
                ],
                responses: { 200: { description: 'ข้อมูลสรุปรายวัน' } },
            },
        },
        '/reports/comparison': {
            get: {
                tags: ['4. Comparison & Alarms'],
                summary: 'ดึงรายงานเปรียบเทียบการใช้พลังงาน (Comparison Report)',
                parameters: [
                    { name: 'siteId', in: 'query', schema: { type: 'integer' } },
                    { name: 'buildingId', in: 'query', schema: { type: 'integer' } },
                    { name: 'periodType', in: 'query', schema: { type: 'string', enum: ['day', 'month', 'year'] }, example: 'month' },
                ],
                responses: { 200: { description: 'ข้อมูลเปรียบเทียบ' } },
            },
        },
        '/reports/alarms': {
            get: {
                tags: ['4. Comparison & Alarms'],
                summary: 'ดึงรายงานประวัติการแจ้งเตือน (Alarm History Report)',
                parameters: [
                    { name: 'startDate', in: 'query', schema: { type: 'string' }, example: '2026-10-01' },
                    { name: 'endDate', in: 'query', schema: { type: 'string' }, example: '2026-10-18' },
                    { name: 'siteId', in: 'query', schema: { type: 'integer' } },
                    { name: 'search', in: 'query', schema: { type: 'string' } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                ],
                responses: { 200: { description: 'รายการประวัติการแจ้งเตือน' } },
            },
        },
        '/reports/{reportType}/export/excel': {
            get: {
                tags: ['5. File Exports'],
                summary: 'ดาวน์โหลดรายงานเป็นไฟล์ Excel (.xlsx)',
                parameters: [
                    { name: 'reportType', in: 'path', required: true, schema: { type: 'string', enum: ['energy-consumption', 'energy-monthly', 'tou', 'tou-monthly', 'history'] }, example: 'energy-consumption' },
                    { name: 'startDate', in: 'query', schema: { type: 'string' }, example: '2026-10-01' },
                    { name: 'endDate', in: 'query', schema: { type: 'string' }, example: '2026-10-18' },
                    { name: 'siteId', in: 'query', schema: { type: 'integer' } },
                ],
                responses: {
                    200: {
                        description: 'ไฟล์ Excel (.xlsx)',
                        content: {
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                                schema: { type: 'string', format: 'binary' },
                            },
                        },
                    },
                },
            },
        },
    },
};

/**
 * Generates an interactive, modern, developer-friendly HTML documentation page
 * for clients and external developers.
 */
export const renderReportDocsHtml = (baseUrl: string = '/api/v1'): string => {
    return `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EnergyPlus - Report Data Extraction API Specification</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0B0F17;
            --surface: #121824;
            --surface-card: #182234;
            --surface-hover: #1E2A40;
            --border: #26354D;
            --border-light: #344869;
            --text-main: #F1F5F9;
            --text-sub: #94A3B8;
            --text-muted: #64748B;
            --primary: #38BDF8;
            --primary-glow: rgba(56, 189, 248, 0.15);
            --accent-green: #34D399;
            --accent-purple: #A78BFA;
            --accent-orange: #FB923C;
            --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            --font-mono: 'JetBrains Mono', monospace;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--bg);
            color: var(--text-main);
            font-family: var(--font-sans);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }

        /* Top Header */
        header {
            position: sticky;
            top: 0;
            z-index: 100;
            background: rgba(11, 15, 23, 0.85);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border);
            padding: 16px 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .header-brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .brand-badge {
            background: var(--primary);
            color: #000;
            font-weight: 800;
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 4px;
            letter-spacing: 0.5px;
        }
        .brand-title {
            font-size: 17px;
            font-weight: 700;
            letter-spacing: -0.3px;
        }
        .header-links {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .btn-link {
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn-outline {
            background: var(--surface);
            border: 1px solid var(--border);
            color: var(--text-main);
        }
        .btn-outline:hover {
            border-color: var(--primary);
            background: var(--surface-hover);
        }
        .btn-primary {
            background: var(--primary);
            color: #020617;
            font-weight: 700;
            border: none;
        }
        .btn-primary:hover {
            opacity: 0.9;
        }

        /* Container Layout */
        .layout-container {
            display: grid;
            grid-template-columns: 280px 1fr;
            min-height: calc(100vh - 65px);
        }

        /* Sidebar Navigation */
        aside {
            position: sticky;
            top: 65px;
            height: calc(100vh - 65px);
            overflow-y: auto;
            border-right: 1px solid var(--border);
            padding: 24px 16px;
            background: var(--surface);
        }
        .nav-section-title {
            font-size: 11px;
            font-weight: 700;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 18px 8px 8px 8px;
        }
        .nav-link {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 6px;
            color: var(--text-sub);
            font-size: 13px;
            font-weight: 500;
            text-decoration: none;
            transition: all 0.15s;
        }
        .nav-link:hover {
            background: var(--surface-hover);
            color: var(--text-main);
        }
        .method-tag {
            font-family: var(--font-mono);
            font-size: 10px;
            font-weight: 700;
            padding: 2px 5px;
            border-radius: 3px;
            min-width: 38px;
            text-align: center;
        }
        .tag-get { background: rgba(52, 211, 153, 0.15); color: var(--accent-green); }
        .tag-post { background: rgba(56, 189, 248, 0.15); color: var(--primary); }

        /* Main Content */
        main {
            padding: 36px 48px;
            max-width: 1040px;
        }

        .hero-banner {
            background: linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(167, 139, 250, 0.05) 100%);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 28px;
            margin-bottom: 36px;
        }
        .hero-banner h1 {
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.5px;
            margin-bottom: 8px;
        }
        .hero-banner p {
            color: var(--text-sub);
            font-size: 14.5px;
            line-height: 1.6;
        }

        /* Endpoint Card */
        .endpoint-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 10px;
            margin-bottom: 28px;
            overflow: hidden;
            scroll-margin-top: 80px;
        }
        .card-header {
            padding: 16px 20px;
            background: var(--surface-card);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }
        .endpoint-title {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .endpoint-path {
            font-family: var(--font-mono);
            font-size: 14px;
            font-weight: 600;
            color: var(--text-main);
        }
        .endpoint-desc {
            font-size: 13.5px;
            color: var(--text-sub);
            padding: 16px 20px 0 20px;
        }

        /* Parameters Table */
        .params-section {
            padding: 16px 20px;
        }
        .section-label {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: var(--text-muted);
            margin-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        th {
            text-align: left;
            padding: 8px 12px;
            background: var(--surface-card);
            color: var(--text-sub);
            font-weight: 600;
            font-size: 11.5px;
            border-bottom: 1px solid var(--border);
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid rgba(38, 53, 77, 0.6);
            color: var(--text-sub);
        }
        tr:last-child td { border-bottom: none; }
        .param-name {
            font-family: var(--font-mono);
            color: var(--primary);
            font-weight: 600;
            font-size: 12.5px;
        }
        .param-type {
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--accent-purple);
        }
        .badge-req {
            background: rgba(239, 68, 68, 0.15);
            color: #F87171;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 3px;
        }
        .badge-opt {
            background: rgba(148, 163, 184, 0.1);
            color: #94A3B8;
            font-size: 10px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 3px;
        }

        /* Code Block */
        .code-container {
            margin: 12px 20px 20px 20px;
            background: #06090E;
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: hidden;
        }
        .code-header {
            background: #0E131C;
            padding: 8px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11.5px;
            color: var(--text-muted);
            border-bottom: 1px solid #1E293B;
        }
        .code-content {
            padding: 14px 16px;
            font-family: var(--font-mono);
            font-size: 12.5px;
            color: #E2E8F0;
            overflow-x: auto;
            white-space: pre;
            line-height: 1.5;
        }
        .btn-copy {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-sub);
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.15s;
        }
        .btn-copy:hover {
            color: var(--text-main);
            border-color: var(--primary);
        }

        /* Callout Box */
        .callout {
            background: rgba(56, 189, 248, 0.06);
            border-left: 3px solid var(--primary);
            padding: 14px 18px;
            border-radius: 0 8px 8px 0;
            margin: 16px 0;
            font-size: 13.5px;
            color: var(--text-sub);
        }
        .callout strong { color: var(--text-main); }

        @media (max-width: 860px) {
            .layout-container { grid-template-columns: 1fr; }
            aside { display: none; }
            main { padding: 24px 16px; }
        }
    </style>
</head>
<body>
    <header>
        <div class="header-brand">
            <span class="brand-badge">API SPEC</span>
            <div class="brand-title">EnergyPlus Report Extraction</div>
        </div>
        <div class="header-links">
            <a href="${baseUrl}/reports/openapi.json" target="_blank" class="btn-link btn-outline">
                📥 OpenAPI JSON
            </a>
            <a href="/docs" target="_blank" class="btn-link btn-primary">
                📖 Swagger Full Docs
            </a>
        </div>
    </header>

    <div class="layout-container">
        <!-- Sidebar Navigation -->
        <aside>
            <div class="nav-section-title">เริ่มต้นใช้งาน</div>
            <a href="#auth" class="nav-link"><span class="method-tag tag-post">POST</span> /auth/login</a>

            <div class="nav-section-title">รายงานการใช้พลังงาน</div>
            <a href="#energy-consumption" class="nav-link"><span class="method-tag tag-get">GET</span> /energy-consumption</a>
            <a href="#tou" class="nav-link"><span class="method-tag tag-get">GET</span> /tou</a>
            <a href="#energy-monthly" class="nav-link"><span class="method-tag tag-get">GET</span> /energy-monthly</a>
            <a href="#tou-monthly" class="nav-link"><span class="method-tag tag-get">GET</span> /tou-monthly</a>

            <div class="nav-section-title">ข้อมูลดิบ & ย้อนหลัง</div>
            <a href="#history" class="nav-link"><span class="method-tag tag-get">GET</span> /history</a>
            <a href="#daily" class="nav-link"><span class="method-tag tag-get">GET</span> /meter-data/daily</a>

            <div class="nav-section-title">การเปรียบเทียบ & แจ้งเตือน</div>
            <a href="#comparison" class="nav-link"><span class="method-tag tag-get">GET</span> /comparison</a>
            <a href="#alarms" class="nav-link"><span class="method-tag tag-get">GET</span> /alarms</a>

            <div class="nav-section-title">ส่งออกไฟล์</div>
            <a href="#export-excel" class="nav-link"><span class="method-tag tag-get">GET</span> /export/excel</a>
        </aside>

        <!-- Main Documentation Content -->
        <main>
            <!-- Hero -->
            <div class="hero-banner">
                <h1>คู่มือการเชื่อมต่อ Report API</h1>
                <p>
                    เอกสารข้อกำหนด API สำหรับให้ลูกค้าภายนอกหรือระบบอัตโนมัติ (Automated Data Pipeline, ERP, PowerBI) ดึงข้อมูลสรุปหน่วยการใช้ไฟฟ้า, ค่าไฟฟ้าอัตรา TOU, และ Log ข้อมูลย้อนหลัง
                </p>
                <div class="callout" style="margin-top: 16px;">
                    <strong>Base URL:</strong> <code>http://&lt;SERVER_HOST&gt;:3003${baseUrl}</code><br>
                    <strong>การยืนยันตัวตน:</strong> แนบ Token ใน Header <code>Authorization: Bearer &lt;accessToken&gt;</code> ทุกคำขอ
                </div>
            </div>

            <!-- 1. Authentication -->
            <section id="auth" class="endpoint-card">
                <div class="card-header">
                    <div class="endpoint-title">
                        <span class="method-tag tag-post">POST</span>
                        <span class="endpoint-path">${baseUrl}/auth/login</span>
                    </div>
                    <span style="font-size: 12px; color: var(--text-muted);">Public Endpoint</span>
                </div>
                <div class="endpoint-desc">
                    เข้าสู่ระบบด้วย Username และ Password ของบัญชีผู้ใช้ที่ได้รับสิทธิ์ เพื่อขอรับ <code>accessToken</code> (JWT Token) สำหรับนำไปใช้เรียก API อื่นๆ
                </div>
                <div class="code-container">
                    <div class="code-header">
                        <span>Request Body (JSON)</span>
                        <button class="btn-copy" onclick="copyToClipboard(this)">Copy cURL</button>
                    </div>
                    <div class="code-content">curl -X POST "http://localhost:3003${baseUrl}/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "api_client",
    "password": "your_password"
  }'</div>
                </div>
                <div class="code-container">
                    <div class="code-header"><span>Response (200 OK)</span></div>
                    <div class="code-content">{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "expiresIn": 86400,
    "user": {
      "userId": 4,
      "userName": "api_client",
      "role": "viewer",
      "siteAccessMode": "assigned",
      "sites": [{ "siteId": 26, "siteName": "วรรณวนัช เบเกอรี่" }]
    }
  }
}</div>
                </div>
            </section>

            <!-- 2. Energy Consumption Report -->
            <section id="energy-consumption" class="endpoint-card">
                <div class="card-header">
                    <div class="endpoint-title">
                        <span class="method-tag tag-get">GET</span>
                        <span class="endpoint-path">${baseUrl}/reports/energy-consumption</span>
                    </div>
                    <span style="font-size: 12px; color: var(--accent-green);">Bearer Token Required</span>
                </div>
                <div class="endpoint-desc">
                    ดึงรายงานหน่วยการใช้ไฟฟ้า (kWh), ค่าไฟ, เลขมิเตอร์เริ่มต้น-สิ้นสุด และ Peak Demand ตามช่วงวันที่กำหนด
                </div>
                <div class="params-section">
                    <div class="section-label">Query Parameters</div>
                    <table>
                        <thead>
                            <tr>
                                <th>พารามิเตอร์</th>
                                <th>ประเภท</th>
                                <th>สถานะ</th>
                                <th>คำอธิบาย</th>
                                <th>ตัวอย่าง</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><span class="param-name">startDate</span></td>
                                <td><span class="param-type">string (date)</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>วันที่เริ่มต้น (YYYY-MM-DD) ค่าเริ่มต้นคือวันนี้</td>
                                <td><code>2026-10-01</code></td>
                            </tr>
                            <tr>
                                <td><span class="param-name">endDate</span></td>
                                <td><span class="param-type">string (date)</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>วันที่สิ้นสุด (YYYY-MM-DD)</td>
                                <td><code>2026-10-18</code></td>
                            </tr>
                            <tr>
                                <td><span class="param-name">siteId</span></td>
                                <td><span class="param-type">integer</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>รหัสไซต์/สาขา (หากไม่ระบุ ระบบจะกรองตามสิทธิ์ของผู้ใช้)</td>
                                <td><code>26</code></td>
                            </tr>
                            <tr>
                                <td><span class="param-name">buildingId</span></td>
                                <td><span class="param-type">integer</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>รหัสอาคาร</td>
                                <td><code>34</code></td>
                            </tr>
                            <tr>
                                <td><span class="param-name">meterTypeId</span></td>
                                <td><span class="param-type">integer</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>รหัสประเภทมิเตอร์</td>
                                <td><code>1</code></td>
                            </tr>
                            <tr>
                                <td><span class="param-name">mdb</span></td>
                                <td><span class="param-type">string</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td><code>exclude</code> (ไม่เอามิเตอร์ MDB), <code>only</code> (เฉพาะ MDB)</td>
                                <td><code>exclude</code></td>
                            </tr>
                            <tr>
                                <td><span class="param-name">page</span></td>
                                <td><span class="param-type">integer</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>ลำดับหน้า (เริ่มต้น 1)</td>
                                <td><code>1</code></td>
                            </tr>
                            <tr>
                                <td><span class="param-name">limit</span></td>
                                <td><span class="param-type">integer</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>จำนวนรายการต่อหน้า (เริ่มต้น 10, สูงสุด 1000)</td>
                                <td><code>100</code></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="code-container">
                    <div class="code-header">
                        <span>cURL Example</span>
                        <button class="btn-copy" onclick="copyToClipboard(this)">Copy</button>
                    </div>
                    <div class="code-content">curl -X GET "http://localhost:3003${baseUrl}/reports/energy-consumption?startDate=2026-10-01&endDate=2026-10-18&limit=100" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"</div>
                </div>
                <div class="code-container">
                    <div class="code-header"><span>Response (200 OK)</span></div>
                    <div class="code-content">{
  "success": true,
  "data": [
    {
      "meter_id": 101,
      "meter_code": "MTR-01",
      "meter_name": "Main Transformer 1",
      "building_name": "อาคารผลิต",
      "zone_name": "ชั้น 1",
      "first_reading": 15420.50,
      "last_reading": 17850.80,
      "diff_reading": 2430.30,
      "total_kwh": 2430.30,
      "multiplier": 1.0,
      "peak_kw": 125.40,
      "cost": 10936.35
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 1,
    "totalPages": 1
  }
}</div>
                </div>
            </section>

            <!-- 3. TOU Report -->
            <section id="tou" class="endpoint-card">
                <div class="card-header">
                    <div class="endpoint-title">
                        <span class="method-tag tag-get">GET</span>
                        <span class="endpoint-path">${baseUrl}/reports/tou</span>
                    </div>
                    <span style="font-size: 12px; color: var(--accent-green);">Bearer Token Required</span>
                </div>
                <div class="endpoint-desc">
                    ดึงรายงานวิเคราะห์ค่าไฟฟ้าตามอัตรา TOU (Time-of-Use) แยกหน่วย On-Peak, Off-Peak, Holiday และยอดคำนวณค่าไฟสุทธิ (รวม Demand, Ft, ภาษีมูลค่าเพิ่ม)
                </div>
                <div class="params-section">
                    <div class="section-label">Query Parameters</div>
                    <table>
                        <thead>
                            <tr>
                                <th>พารามิเตอร์</th>
                                <th>ประเภท</th>
                                <th>คำอธิบาย</th>
                                <th>ตัวอย่าง</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><span class="param-name">startDate</span></td>
                                <td><span class="param-type">string (date)</span></td>
                                <td>วันที่เริ่มต้น (YYYY-MM-DD)</td>
                                <td><code>2026-10-01</code></td>
                            </tr>
                            <tr>
                                <td><span class="param-name">endDate</span></td>
                                <td><span class="param-type">string (date)</span></td>
                                <td>วันที่สิ้นสุด (YYYY-MM-DD)</td>
                                <td><code>2026-10-18</code></td>
                            </tr>
                            <tr>
                                <td><span class="param-name">siteId</span></td>
                                <td><span class="param-type">integer</span></td>
                                <td>รหัสไซต์ที่ต้องการดึง</td>
                                <td><code>26</code></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="code-container">
                    <div class="code-header">
                        <span>cURL Example</span>
                        <button class="btn-copy" onclick="copyToClipboard(this)">Copy</button>
                    </div>
                    <div class="code-content">curl -X GET "http://localhost:3003${baseUrl}/reports/tou?startDate=2026-10-01&endDate=2026-10-18" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"</div>
                </div>
                <div class="code-container">
                    <div class="code-header"><span>Response (200 OK)</span></div>
                    <div class="code-content">{
  "success": true,
  "data": [
    {
      "meter_id": 101,
      "meter_code": "MTR-01",
      "customer_name": "Main Transformer",
      "site_name": "วรรณวนัช เบเกอรี่",
      "total_kwh": 3700.60,
      "on_peak_kwh": 2100.40,
      "off_peak_kwh": 1100.20,
      "holiday_kwh": 500.00,
      "max_kw": 185.50,
      "on_peak_cost": 12178.52,
      "off_peak_cost": 2901.12,
      "holiday_cost": 1318.45,
      "demand_cost": 38955.00,
      "ft_cost": 600.61,
      "service_charge": 38.22,
      "vat_amount": 3919.43,
      "total_cost": 59911.35
    }
  ]
}</div>
                </div>
            </section>

            <!-- 4. Monthly Reports -->
            <section id="energy-monthly" class="endpoint-card">
                <div class="card-header">
                    <div class="endpoint-title">
                        <span class="method-tag tag-get">GET</span>
                        <span class="endpoint-path">${baseUrl}/reports/energy-monthly</span>
                    </div>
                    <span style="font-size: 12px; color: var(--accent-green);">Bearer Token Required</span>
                </div>
                <div class="endpoint-desc">
                    ดึงรายงานการใช้พลังงานและค่าไฟฟ้ารายเดือนตลอดทั้งปี ระบุปี ค.ศ. (เช่น <code>year=2026</code>)
                </div>
                <div class="code-container">
                    <div class="code-header">
                        <span>cURL Example</span>
                        <button class="btn-copy" onclick="copyToClipboard(this)">Copy</button>
                    </div>
                    <div class="code-content">curl -X GET "http://localhost:3003${baseUrl}/reports/energy-monthly?year=2026&month=10" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"</div>
                </div>
            </section>

            <!-- 5. Historical Raw Interval Logs -->
            <section id="history" class="endpoint-card">
                <div class="card-header">
                    <div class="endpoint-title">
                        <span class="method-tag tag-get">GET</span>
                        <span class="endpoint-path">${baseUrl}/reports/history</span>
                    </div>
                    <span style="font-size: 12px; color: var(--accent-green);">Bearer Token Required</span>
                </div>
                <div class="endpoint-desc">
                    ดึงข้อมูลบันทึกดิบรายรอบเวลา (Interval telemetry logs: แรงดัน V, กระแส A, กำลังไฟฟ้า kW, kVAR, Power Factor)
                </div>
                <div class="code-container">
                    <div class="code-header">
                        <span>cURL Example</span>
                        <button class="btn-copy" onclick="copyToClipboard(this)">Copy</button>
                    </div>
                    <div class="code-content">curl -X GET "http://localhost:3003${baseUrl}/reports/history?meterId=101&startDate=2026-10-18&endDate=2026-10-18&limit=50" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"</div>
                </div>
            </section>

            <!-- 6. Excel Export -->
            <section id="export-excel" class="endpoint-card">
                <div class="card-header">
                    <div class="endpoint-title">
                        <span class="method-tag tag-get">GET</span>
                        <span class="endpoint-path">${baseUrl}/reports/{reportType}/export/excel</span>
                    </div>
                    <span style="font-size: 12px; color: var(--accent-green);">Binary File (.xlsx)</span>
                </div>
                <div class="endpoint-desc">
                    ดาวน์โหลดรายงานที่จัดรูปแบบเป็นไฟล์ Microsoft Excel (.xlsx) โดยตรงผ่าน API<br>
                    <strong>reportType ที่รองรับ:</strong> <code>energy-consumption</code>, <code>tou</code>, <code>energy-monthly</code>, <code>tou-monthly</code>, <code>history</code>
                </div>
                <div class="code-container">
                    <div class="code-header">
                        <span>cURL Example (Save to file)</span>
                        <button class="btn-copy" onclick="copyToClipboard(this)">Copy</button>
                    </div>
                    <div class="code-content">curl -X GET "http://localhost:3003${baseUrl}/reports/energy-consumption/export/excel?startDate=2026-10-01&endDate=2026-10-18" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -o "energy_report.xlsx"</div>
                </div>
            </section>
        </main>
    </div>

    <script>
        function copyToClipboard(button) {
            const codeBlock = button.parentElement.nextElementSibling;
            const text = codeBlock.innerText;
            navigator.clipboard.writeText(text).then(() => {
                const originalText = button.innerText;
                button.innerText = 'Copied!';
                button.style.borderColor = 'var(--accent-green)';
                button.style.color = 'var(--accent-green)';
                setTimeout(() => {
                    button.innerText = originalText;
                    button.style.borderColor = '';
                    button.style.color = '';
                }, 2000);
            });
        }
    </script>
</body>
</html>`;
};
