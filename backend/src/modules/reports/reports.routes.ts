import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { authenticate } from '../../middleware/auth';
import { ReportsController } from './reports.controller';
import { enforceSiteAccess, requireRole } from '../../middleware/accessControl';
import { reportOpenApiDocument, renderReportDocsHtml } from './reportDocs';

const router = Router();
const controller = new ReportsController();

// ── Public Report API Documentation & Specification (No Auth Required) ──
// 1. Beautiful Standalone Developer Guide Portal
router.get('/docs', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const host = req.get('host');
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const origin = host ? `${protocol}://${host}` : '';
    res.send(renderReportDocsHtml('/api/v1', origin));
});

// 2. OpenAPI 3.0 JSON Specification
router.get('/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(reportOpenApiDocument);
});

router.get('/spec.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(reportOpenApiDocument);
});

// 3. Dedicated Swagger UI for Reports
router.use('/swagger', swaggerUi.serveFiles(reportOpenApiDocument), swaggerUi.setup(reportOpenApiDocument));

// ── Authenticated Data Extraction Routes (Auth Required) ──
router.use(authenticate, enforceSiteAccess);
router.get('/energy-consumption', controller.getEnergyConsumption);
router.get('/energy-monthly', controller.getEnergyMonthlyReport);
router.get('/tou', controller.getTouReport);
router.get('/tou-monthly', controller.getTouMonthlyReport);
router.get('/history', controller.getHistory);
router.get('/comparison', controller.getComparison);
router.get('/alarms', controller.getAlarms);
router.post('/alarms/clear', requireRole('operator', 'admin'), controller.clearAlarms);
router.delete('/alarms/clear', requireRole('operator', 'admin'), controller.clearAlarms);
router.put('/alarms/:id/acknowledge', requireRole('operator', 'admin'), controller.acknowledgeAlarm);

// ── รูปแบบการส่งข้อมูลมิเตอร์ไฟฟ้า_น้ำ (Standard Meter Readings Export: CSV / JSON) ──
router.get('/meter-readings', controller.getMeterReadingsReport);
router.get('/meter-readings/export/csv', controller.getMeterReadingsReportCsv);

// ── Generic File Export Routes (.csv and .xlsx) ──
router.get('/:reportType/export/csv', controller.exportReportCsv);
router.get('/:reportType/export/excel', controller.exportReportExcel);

export default router;

