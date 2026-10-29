import { Request, Response } from 'express';

// OpenAPI 3.0 Document dedicated specifically to Report APIs
export const reportOpenApiDocument: any = {
    openapi: '3.0.3',
    info: {
        title: 'EnergyPlus - Report Data Extraction API',
        version: '1.0.4',
        description: `
### เอกสารข้อกำหนด API สำหรับการดึงข้อมูลรายงาน (Report API Specification)

API ชุดนี้จัดทำขึ้นเพื่อให้ระบบภายนอก (Third-party System, ERP, BI Tools, ลูกค้า) สามารถเชื่อมต่อเพื่อดึงข้อมูลสรุปหน่วยมิเตอร์ไฟฟ้า-น้ำ และข้อมูลดิบย้อนหลังของมิเตอร์ไปประมวลผลต่อได้

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
            HistoryRecordItem: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 1001 },
                    meter_id: { type: 'integer', example: 1 },
                    meter_code: { type: 'string', example: 'MTR-001' },
                    meter_name: { type: 'string', example: 'Main Feeder 1' },
                    date_keep: { type: 'string', format: 'date-time', example: '2026-01-01T10:15:00.000Z' },
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
            MeterReadingExportItem: {
                type: 'object',
                description: 'รูปแบบแถวข้อมูลสรุปหน่วยมิเตอร์ไฟฟ้า/น้ำ (Standard Meter Readings Export Row)',
                properties: {
                    BATCH_NAME: {
                        type: 'string',
                        example: '',
                        description: 'ชื่อชุดข้อมูล (Batch Name) ค่าเริ่มต้นเป็นค่าว่าง หรือระบุผ่าน query parameter',
                    },
                    LEASE_NUMBER: {
                        type: 'string',
                        example: 'CYA041-2025-0062',
                        description: 'เลขที่สัญญาเช่า (Lease Number) เช่น CYA041-2025-0062, CYA041-สัญญา A2-250301-0009, ออฟฟิศ, ภายนอก, ส่วนกลาง',
                    },
                    'VR NUMBER': {
                        type: 'string',
                        example: 'CYA041-1101 (STU)-E5.71-สิทธิ',
                        description: 'รหัสมิเตอร์ประจำห้อง/ผู้เช่า (VR Number) เช่น CYA041-1101 (STU)-E5.71-สิทธิ (ไฟฟ้า) หรือ CYA041-1101 (STU)-W20-สิทธิ (น้ำ)',
                    },
                    REP_STR_DATE: {
                        type: 'string',
                        example: '1-Feb-26',
                        description: 'วันที่เริ่มต้นรอบบันทึกข้อมูล รูปแบบ D-MMM-YY (เช่น 1-Feb-26, 1-Mar-26)',
                    },
                    REP_END_DATE: {
                        type: 'string',
                        example: '28-Feb-26',
                        description: 'วันที่สิ้นสุดรอบบันทึกข้อมูล รูปแบบ D-MMM-YY (เช่น 28-Feb-26, 31-Mar-26)',
                    },
                    USAGE: {
                        type: 'integer',
                        example: 181,
                        description: 'หน่วยการใช้งานที่คำนวณได้ (USAGE = METER_TO - METER_FROM)',
                    },
                    METER_FROM: {
                        type: 'integer',
                        example: 14943,
                        description: 'เลขมิเตอร์เริ่มต้นรอบ (Start Reading)',
                    },
                    METER_TO: {
                        type: 'integer',
                        example: 15124,
                        description: 'เลขมิเตอร์สิ้นสุดรอบ (End Reading)',
                    },
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
                                    username: { type: 'string', example: 'api_user' },
                                    password: { type: 'string', example: 'your_password' },
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
        '/reports/history': {
            get: {
                tags: ['3. Raw & Historical Data'],
                summary: 'ดึงบันทึกข้อมูลย้อนหลังของมิเตอร์ (Historical Interval Data)',
                description: 'ดึงข้อมูลค่ากระแสไฟฟ้า แรงดัน กำลังไฟฟ้า และหน่วยสะสม ทุกรอบการบันทึก (interval log)',
                parameters: [
                    { name: 'meterId', in: 'query', schema: { type: 'integer' }, description: 'รหัสมิเตอร์' },
                    { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-01-01' },
                    { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-01-31' },
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
                    { name: 'startDate', in: 'query', schema: { type: 'string' }, example: '2026-01-01' },
                    { name: 'endDate', in: 'query', schema: { type: 'string' }, example: '2026-01-31' },
                ],
                responses: { 200: { description: 'ข้อมูลสรุปรายวัน' } },
            },
        },
        '/reports/meter-readings': {
            get: {
                tags: ['2. Meter Readings Export (CSV / JSON)'],
                summary: 'ดึงข้อมูลมิเตอร์ไฟฟ้า-น้ำ ตามรูปแบบมาตรฐาน (CSV / JSON)',
                description: `
เรียกดูและส่งออกข้อมูลสรุปหน่วยมิเตอร์ไฟฟ้า และมิเตอร์น้ำ ตามรูปแบบมาตรฐานสากล
- **Header คอลัมน์:** \`BATCH_NAME|LEASE_NUMBER|VR NUMBER|REP_STR_DATE|REP_END_DATE|USAGE|METER_FROM|METER_TO\`
- **รูปแบบผลลัพธ์ (Output):**
  - \`format=csv\` (ค่าเริ่มต้น): ส่งคืนเป็นไฟล์ **CSV (.csv)** พร้อม Header UTF-8 BOM รองรับการเปิดด้วย Microsoft Excel โดยตัวอักษรภาษาไทยไม่เพี้ยน
  - \`format=json\`: ส่งคืนเป็น JSON Array
- **คั่นข้อมูล (Delimiter):**
  - \`delimiter=pipe\` (หรือ \`|\`) ค่าเริ่มต้น คั่นด้วย Pipe (|)
  - \`delimiter=comma\` (หรือ \`,\`) สำหรับ CSV แบบ Comma Separated มาตรฐาน
- **การกรองประเภทมิเตอร์ (utilityType):**
  - \`utilityType=electric\` ดึงเฉพาะมิเตอร์ไฟฟ้า
  - \`utilityType=water\` ดึงเฉพาะมิเตอร์น้ำ
  - \`utilityType=all\` ดึงข้อมูลมิเตอร์ทั้งหมด
                `,
                parameters: [
                    { name: 'startDate', in: 'query', schema: { type: 'string' }, example: '2026-02-01', description: 'วันที่เริ่มต้นรอบ (YYYY-MM-DD)' },
                    { name: 'endDate', in: 'query', schema: { type: 'string' }, example: '2026-02-28', description: 'วันที่สิ้นสุดรอบ (YYYY-MM-DD)' },
                    { name: 'year', in: 'query', schema: { type: 'integer' }, example: 2026, description: 'ปีที่ต้องการดึงข้อมูล (ใช้คู่กับ month แทน startDate/endDate ได้)' },
                    { name: 'month', in: 'query', schema: { type: 'integer' }, example: 2, description: 'เดือนที่ต้องการดึงข้อมูล 1-12' },
                    {
                        name: 'utilityType',
                        in: 'query',
                        schema: { type: 'string', enum: ['all', 'electric', 'water'], default: 'all' },
                        description: 'ประเภทมิเตอร์: electric (ไฟฟ้า) หรือ water (น้ำ)',
                    },
                    {
                        name: 'format',
                        in: 'query',
                        schema: { type: 'string', enum: ['csv', 'json'], default: 'csv' },
                        description: 'รูปแบบไฟล์ผลลัพธ์: csv (ดาวน์โหลดไฟล์ .csv) หรือ json',
                    },
                    {
                        name: 'delimiter',
                        in: 'query',
                        schema: { type: 'string', enum: ['pipe', 'comma'], default: 'pipe' },
                        description: 'เครื่องหมายคั่นฟิลด์: pipe (|) หรือ comma (,)',
                    },
                    { name: 'batchName', in: 'query', schema: { type: 'string' }, example: '', description: 'รหัสชุดข้อมูล BATCH_NAME (ค่าเริ่มต้นเป็นค่าว่าง)' },
                    { name: 'siteId', in: 'query', schema: { type: 'integer' }, description: 'รหัสโครงการ / Site ID' },
                    { name: 'search', in: 'query', schema: { type: 'string' }, description: 'ค้นหาตามเลขที่สัญญา, รหัสมิเตอร์, ชื่อผู้เช่า' },
                ],
                responses: {
                    200: {
                        description: 'ไฟล์ CSV (.csv) หรือ JSON Array ตามรูปแบบมาตรฐาน',
                        content: {
                            'text/csv': {
                                schema: { type: 'string', format: 'binary' },
                                example: `BATCH_NAME|LEASE_NUMBER|VR NUMBER|REP_STR_DATE|REP_END_DATE|USAGE|METER_FROM|METER_TO
|CYA041-2025-0062|CYA041-1101 (STU)-E5.71-สิทธิ|1-Feb-26|28-Feb-26|181|14943|15124
|CYA041-2025-0033|CYA041-1102 (STU)-E5.71-ณัฏฐว|1-Feb-26|28-Feb-26|118|10479|10597
|CYA041-2025-0011|CYA041-1103 (STU)-E5.71-อัญช|1-Feb-26|28-Feb-26|18|2733|2751
|ออฟฟิศ|สำนักงาน-สำนักงานออฟฟิศ|1-Feb-26|28-Feb-26|811|61624|62435
|ส่วนกลาง|ส่วนกลาง-ส่วนกลาง|1-Feb-26|28-Feb-26|193|1291|1484`,
                            },
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/MeterReadingExportItem' },
                                        },
                                        summary: {
                                            type: 'object',
                                            properties: {
                                                totalMeters: { type: 'integer', example: 50 },
                                                totalUsage: { type: 'integer', example: 5240 },
                                                startDate: { type: 'string', example: '2026-02-01' },
                                                endDate: { type: 'string', example: '2026-02-28' },
                                                repStartDate: { type: 'string', example: '1-Feb-26' },
                                                repEndDate: { type: 'string', example: '28-Feb-26' },
                                                utilityType: { type: 'string', example: 'electric' },
                                                delimiter: { type: 'string', example: 'pipe' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/reports/meter-readings/export/csv': {
            get: {
                tags: ['2. Meter Readings Export (CSV / JSON)'],
                summary: 'ดาวน์โหลดไฟล์ CSV สรุปหน่วยมิเตอร์โดยตรง (.csv)',
                description: 'Endpoint สำหรับดาวน์โหลดไฟล์ .csv ที่จัดรูปแบบคอลัมน์มาตรฐานทันที',
                parameters: [
                    { name: 'startDate', in: 'query', schema: { type: 'string' }, example: '2026-02-01' },
                    { name: 'endDate', in: 'query', schema: { type: 'string' }, example: '2026-02-28' },
                    { name: 'utilityType', in: 'query', schema: { type: 'string', enum: ['all', 'electric', 'water'], default: 'all' } },
                    { name: 'delimiter', in: 'query', schema: { type: 'string', enum: ['pipe', 'comma'], default: 'pipe' } },
                    { name: 'batchName', in: 'query', schema: { type: 'string' } },
                    { name: 'siteId', in: 'query', schema: { type: 'integer' } },
                ],
                responses: {
                    200: {
                        description: 'ไฟล์ CSV (.csv)',
                        content: {
                            'text/csv': {
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
export const renderReportDocsHtml = (baseUrl: string = '/api/v1', origin?: string): string => {
    const serverOrigin = (origin && origin.trim()) ? origin.trim().replace(/\/+$/, '') : 'http://<url>:<port>';
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

            <div class="nav-section-title">รูปแบบมิเตอร์ไฟฟ้า-น้ำ (Meter Readings)</div>
            <a href="#meter-readings" class="nav-link"><span class="method-tag tag-get">GET</span> /meter-readings</a>
            <a href="#meter-readings-export-csv" class="nav-link"><span class="method-tag tag-get">GET</span> /meter-readings/export/csv</a>

            <div class="nav-section-title">ข้อมูลดิบ & ย้อนหลัง</div>
            <a href="#history" class="nav-link"><span class="method-tag tag-get">GET</span> /history</a>
            <a href="#daily" class="nav-link"><span class="method-tag tag-get">GET</span> /meter-data/daily</a>
        </aside>

        <!-- Main Documentation Content -->
        <main>
            <!-- Hero -->
            <div class="hero-banner">
                <h1>คู่มือการเชื่อมต่อ Report API</h1>
                <p>
                    เอกสารข้อกำหนด API สำหรับให้ลูกค้าภายนอกหรือระบบอัตโนมัติ (Automated Data Pipeline, ERP, PowerBI) ดึงข้อมูลสรุปหน่วยมิเตอร์ไฟฟ้า-น้ำ และ Log ข้อมูลย้อนหลัง
                </p>
                <div class="callout" style="margin-top: 16px;">
                    <strong>Base URL:</strong> <code>${serverOrigin}${baseUrl}</code><br>
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
                    <div class="code-content">curl -X POST "${serverOrigin}${baseUrl}/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "YOUR_USERNAME",
    "password": "YOUR_PASSWORD"
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
      "userId": 1,
      "userName": "api_user",
      "role": "viewer",
      "siteAccessMode": "all",
      "sites": [{ "siteId": 1, "siteName": "Example Site A" }]
    }
  }
}</div>
                </div>
            </section>

            <!-- Standard Meter Readings Export -->
            <section id="meter-readings" class="endpoint-card">
                <div class="card-header">
                    <div class="endpoint-title">
                        <span class="method-tag tag-get">GET</span>
                        <span class="endpoint-path">${baseUrl}/reports/meter-readings</span>
                    </div>
                    <span style="font-size: 12px; color: var(--accent-green);">Bearer Token Required • CSV (.csv) & JSON</span>
                </div>
                <div class="endpoint-desc">
                    <strong>รูปแบบการส่งข้อมูลมิเตอร์ไฟฟ้า_น้ำ (Standard Meter Readings Export):</strong><br>
                    เรียกดูและส่งออกข้อมูลมิเตอร์ไฟฟ้า และมิเตอร์น้ำ ตามรูปแบบมาตรฐาน ได้รับผลลัพธ์เป็นไฟล์ <strong>CSV (.csv)</strong> ที่มี UTF-8 BOM เปิดอ่านด้วย Microsoft Excel ได้ทันทีโดยภาษาไทยไม่เพี้ยน หรือเลือกดูเป็น JSON
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
                                <td>วันที่เริ่มต้นรอบ (YYYY-MM-DD) เช่น <code>2026-02-01</code></td>
                                <td>2026-02-01</td>
                            </tr>
                            <tr>
                                <td><span class="param-name">endDate</span></td>
                                <td><span class="param-type">string (date)</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>วันที่สิ้นสุดรอบ (YYYY-MM-DD) เช่น <code>2026-02-28</code></td>
                                <td>2026-02-28</td>
                            </tr>
                            <tr>
                                <td><span class="param-name">utilityType</span></td>
                                <td><span class="param-type">string</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>ประเภทมิเตอร์: <code>electric</code> (ไฟฟ้า), <code>water</code> (น้ำ), <code>all</code> (ทั้งหมด)</td>
                                <td>electric</td>
                            </tr>
                            <tr>
                                <td><span class="param-name">format</span></td>
                                <td><span class="param-type">string</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>รูปแบบผลลัพธ์: <code>csv</code> (ดาวน์โหลดไฟล์ .csv - ค่าเริ่มต้น) หรือ <code>json</code></td>
                                <td>csv</td>
                            </tr>
                            <tr>
                                <td><span class="param-name">delimiter</span></td>
                                <td><span class="param-type">string</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>เครื่องหมายคั่นฟิลด์: <code>pipe</code> (<code>|</code> ตามตัวอย่างใน PDF หน้า 2) หรือ <code>comma</code> (<code>,</code>)</td>
                                <td>pipe</td>
                            </tr>
                            <tr>
                                <td><span class="param-name">batchName</span></td>
                                <td><span class="param-type">string</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>ชื่อชุดข้อมูล BATCH_NAME (ค่าเริ่มต้นเป็นค่าว่าง <code>""</code> ตามตัวอย่างใน PDF)</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td><span class="param-name">siteId</span></td>
                                <td><span class="param-type">integer</span></td>
                                <td><span class="badge-opt">Optional</span></td>
                                <td>รหัสโครงการ (Site ID) เพื่อกรองเฉพาะไซต์ที่ต้องการ</td>
                                <td>1</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="params-section" style="margin-top: 16px;">
                    <div class="section-label">โครงสร้างคอลัมน์ข้อมูล (Output Columns Specification)</div>
                    <table>
                        <thead>
                            <tr>
                                <th>ลำดับ</th>
                                <th>ชื่อคอลัมน์</th>
                                <th>ชนิดข้อมูล</th>
                                <th>คำอธิบาย</th>
                                <th>ตัวอย่างข้อมูลตาม PDF</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>1</td>
                                <td><strong>BATCH_NAME</strong></td>
                                <td>string</td>
                                <td>ชื่อชุดข้อมูล (ตามตัวอย่างใน PDF เป็นค่าว่าง)</td>
                                <td><code></code></td>
                            </tr>
                            <tr>
                                <td>2</td>
                                <td><strong>LEASE_NUMBER</strong></td>
                                <td>string</td>
                                <td>เลขที่สัญญาเช่าห้อง/พื้นที่เช่า</td>
                                <td><code>CYA041-2025-0062</code>, <code>ออฟฟิศ</code>, <code>ส่วนกลาง</code></td>
                            </tr>
                            <tr>
                                <td>3</td>
                                <td><strong>VR NUMBER</strong></td>
                                <td>string</td>
                                <td>รหัสมิเตอร์ประจำห้องหรือชื่อผู้เช่า (มีรหัสประเภท -E5.71- หรือ -W20-)</td>
                                <td><code>CYA041-1101 (STU)-E5.71-สิทธิ</code>, <code>CYA041-1101 (STU)-W20-สิทธิ</code></td>
                            </tr>
                            <tr>
                                <td>4</td>
                                <td><strong>REP_STR_DATE</strong></td>
                                <td>string</td>
                                <td>วันที่เริ่มต้นรอบ รูปแบบ <code>D-MMM-YY</code></td>
                                <td><code>1-Feb-26</code>, <code>1-Mar-26</code></td>
                            </tr>
                            <tr>
                                <td>5</td>
                                <td><strong>REP_END_DATE</strong></td>
                                <td>string</td>
                                <td>วันที่สิ้นสุดรอบ รูปแบบ <code>D-MMM-YY</code></td>
                                <td><code>28-Feb-26</code>, <code>31-Mar-26</code></td>
                            </tr>
                            <tr>
                                <td>6</td>
                                <td><strong>USAGE</strong></td>
                                <td>integer</td>
                                <td>หน่วยการใช้งานคำนวณได้ = METER_TO - METER_FROM</td>
                                <td><code>181</code>, <code>2</code></td>
                            </tr>
                            <tr>
                                <td>7</td>
                                <td><strong>METER_FROM</strong></td>
                                <td>integer</td>
                                <td>เลขมิเตอร์เริ่มต้นรอบ (Start Reading)</td>
                                <td><code>14943</code>, <code>22</code></td>
                            </tr>
                            <tr>
                                <td>8</td>
                                <td><strong>METER_TO</strong></td>
                                <td>integer</td>
                                <td>เลขมิเตอร์สิ้นสุดรอบ (End Reading)</td>
                                <td><code>15124</code>, <code>24</code></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Sample CSV Box: Electricity -->
                <div class="code-container" style="margin-top: 20px;">
                    <div class="code-header">
                        <span>ตัวอย่างผลลัพธ์ CSV: มิเตอร์ไฟฟ้า</span>
                        <button class="btn-copy" onclick="copyToClipboard(this)">Copy</button>
                    </div>
                    <div class="code-content">LEASE_NUMBER|VR NUMBER|REP_STR_DATE|REP_END_DATE|USAGE|METER_FROM|METER_TO
CYA041-2025-0062|CYA041-1101 (STU)-E5.71-สิทธิ|1-Feb-26|28-Feb-26|181|14943|15124
CYA041-2025-0033|CYA041-1102 (STU)-E5.71-ณัฏฐว|1-Feb-26|28-Feb-26|118|10479|10597
CYA041-2025-0011|CYA041-1103 (STU)-E5.71-อัญช|1-Feb-26|28-Feb-26|18|2733|2751
CYA041-2025-0018|CYA041-1104 (STU)-E5.71-จตุพล|1-Feb-26|28-Feb-26|160|10307|10467
CYA041-2025-0025|CYA041-1105 (STU)-E5.71-นิมาด|1-Feb-26|28-Feb-26|74|8098|8172
ออฟฟิศ|สำนักงาน-สำนักงานออฟฟิศ|1-Feb-26|28-Feb-26|811|61624|62435
ภายนอก|ภายนอก-ส่วนกลาง|1-Feb-26|28-Feb-26|560|38583|39143
ส่วนกลาง|ส่วนกลาง-ส่วนกลาง|1-Feb-26|28-Feb-26|193|1291|1484</div>
                </div>

                <!-- Sample CSV Box: Water -->
                <div class="code-container">
                    <div class="code-header">
                        <span>ตัวอย่างผลลัพธ์ CSV: มิเตอร์น้ำ (Pipe Delimited)</span>
                        <button class="btn-copy" onclick="copyToClipboard(this)">Copy</button>
                    </div>
                    <div class="code-content">LEASE_NUMBER|VR NUMBER|REP_STR_DATE|REP_END_DATE|USAGE|METER_FROM|METER_TO
CYA041-2025-0062|CYA041-1101 (STU)-W20-สิทธิ|1-Mar-26|31-Mar-26|2|22|24
CYA041-2026-0014|CYA041-1103-W20-อัญชลี|1-Mar-26|31-Mar-26|2|197|199
CYA041-2025-0018|CYA041-1104 (STU)-W20-จตุพ|1-Mar-26|31-Mar-26|2|198|200
CYA041-2025-0025|CYA041-1105 (STU)-W20-นิมา|1-Mar-26|31-Mar-26|1|340|341
CYA041-สัญญา A2-250301-0009|CYA041-W20-Trendy wash|1-Mar-26|31-Mar-26|14|164|178
CYA041-สัญญา A2-250301-0009|CYA041-E7-Trendy wash|1-Mar-26|31-Mar-26|130|1347|1477</div>
                </div>

                <!-- cURL Command: Download Electricity CSV -->
                <div class="code-container">
                    <div class="code-header">
                        <span>cURL: ดาวน์โหลดไฟล์ CSV มิเตอร์ไฟฟ้า</span>
                        <button class="btn-copy" onclick="copyToClipboard(this)">Copy</button>
                    </div>
                    <div class="code-content">curl -X GET "${serverOrigin}${baseUrl}/reports/meter-readings?startDate=2026-02-01&endDate=2026-02-28&utilityType=electric&format=csv" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -o "meter_readings_electric_2026_02.csv"</div>
                </div>

                <!-- cURL Command: Download Water CSV -->
                <div class="code-container">
                    <div class="code-header">
                        <span>cURL: ดาวน์โหลดไฟล์ CSV มิเตอร์น้ำ</span>
                        <button class="btn-copy" onclick="copyToClipboard(this)">Copy</button>
                    </div>
                    <div class="code-content">curl -X GET "${serverOrigin}${baseUrl}/reports/meter-readings?startDate=2026-03-01&endDate=2026-03-31&utilityType=water&format=csv" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -o "meter_readings_water_2026_03.csv"</div>
                </div>

                <!-- Direct CSV Download Endpoint Alias -->
                <div class="callout" style="margin-top: 16px;">
                    💡 <strong>ทางเลือกสำหรับการดาวน์โหลดตรง (Direct Download):</strong> สามารถเรียกผ่าน <code>GET ${baseUrl}/reports/meter-readings/export/csv?startDate=...&endDate=...</code> เพื่อดาวน์โหลดไฟล์ .csv ได้โดยตรง
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
                    <div class="code-content">curl -X GET "${serverOrigin}${baseUrl}/reports/history?meterId=1&startDate=2026-01-01&endDate=2026-01-01&limit=50" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"</div>
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

        // Dynamically sync origin with user's current browser location
        document.addEventListener('DOMContentLoaded', function() {
            try {
                var origin = window.location.origin;
                if (origin) {
                    document.querySelectorAll('.code-content, .callout code').forEach(function(el) {
                        el.innerHTML = el.innerHTML
                            .replace(/http:\/\/(?:&lt;url&gt;|&lt;SERVER_HOST&gt;):(?:\d+|&lt;port&gt;)/g, origin)
                            .replace(/http:\/\/&lt;url&gt;:&lt;port&gt;/g, origin)
                            .replace(/http:\/\/<url>:<port>/g, origin)
                            .replace(/http:\/\/localhost:3003/g, origin);
                    });
                }
            } catch (e) {}
        });
    </script>
</body>
</html>`;
};
