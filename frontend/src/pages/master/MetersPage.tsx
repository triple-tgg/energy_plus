import React, { useEffect, useState, useCallback, useRef } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { metersApi, sitesApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';
import * as XLSX from 'xlsx';

interface MeterForm {
    meterCode: string;
    meterName: string;
    address: string;
    meterBrandId: string;
    meterTypeId: string;
    loopId: string;
    siteId: string;
    buildingId: string;
    zoneId: string;
    ipAddress: string;
    portNumber: string;
    roomCode: string;
    roomName: string;
    phase: string;
    circuit: string;
    floor: string;
    status: string;
    parentMeterId: string;
    isActive: boolean;
}

const emptyForm: MeterForm = {
    meterCode: '', meterName: '', address: '', meterBrandId: '', meterTypeId: '',
    loopId: '', siteId: '', buildingId: '', zoneId: '', ipAddress: '', portNumber: '',
    roomCode: '', roomName: '', phase: '', circuit: '', floor: '', status: 'Manual',
    parentMeterId: '', isActive: true,
};

// Excel column mapping for the 111PMT format
interface ParsedMeter {
    address: string;
    circuit: string;
    building: string;
    zone: string;
    meterType: string;
    meterCode: string;
    meterName: string;
    roomCode: string;
    roomName: string;
    loop: number | null;
    meterModel: string;
    portNumber: number | null;
    ipAddress: string;
    phase: number | null;
    floor: number | null;
}

const MetersPage: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    // Lookup data
    const [sites, setSites] = useState<any[]>([]);
    const [buildings, setBuildings] = useState<any[]>([]);
    const [zones, setZones] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [types, setTypes] = useState<any[]>([]);
    const [loops, setLoops] = useState<any[]>([]);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<MeterForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete
    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Manual entry modal states
    const [showManualModal, setShowManualModal] = useState(false);
    const [selectedMeterForManual, setSelectedMeterForManual] = useState<any>(null);
    const [manualDateKeep, setManualDateKeep] = useState('');
    const [manualValue, setManualValue] = useState('');
    const [manualSaving, setManualSaving] = useState(false);
    const [manualError, setManualError] = useState('');

    // QR Code modal states
    const [showQrModal, setShowQrModal] = useState(false);
    const [selectedMeterForQr, setSelectedMeterForQr] = useState<any>(null);

    // Filter states (temp selections)
    const [tempMeterTypeId, setTempMeterTypeId] = useState('');
    const [tempSiteId, setTempSiteId] = useState('');
    const [tempBuildingId, setTempBuildingId] = useState('');
    const [tempZoneId, setTempZoneId] = useState('');

    // Applied filter states
    const [filterMeterTypeId, setFilterMeterTypeId] = useState('');
    const [filterSiteId, setFilterSiteId] = useState('');
    const [filterBuildingId, setFilterBuildingId] = useState('');
    const [filterZoneId, setFilterZoneId] = useState('');

    // Header manual entry selection
    const [allMetersForSelect, setAllMetersForSelect] = useState<any[]>([]);
    const [manualMeterSelectId, setManualMeterSelectId] = useState('');

    // Import
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [parsedMeters, setParsedMeters] = useState<ParsedMeter[]>([]);
    const [importFileName, setImportFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);
    const [showImportResult, setShowImportResult] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page, limit };
            if (filterMeterTypeId) params.meterTypeId = filterMeterTypeId;
            if (filterSiteId) params.siteId = filterSiteId;
            if (filterBuildingId) params.buildingId = filterBuildingId;
            if (filterZoneId) params.zoneId = filterZoneId;
            const res = await metersApi.getAll(params);
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit, filterMeterTypeId, filterSiteId, filterBuildingId, filterZoneId]);

    const fetchLookups = useCallback(async () => {
        try {
            const [sRes, bRes, zRes, brRes, tRes, lRes] = await Promise.all([
                sitesApi.getAll({ limit: 200 }),
                sitesApi.getAllBuildings({ limit: 200 }),
                sitesApi.getZones({ limit: 200 }),
                metersApi.getBrands({ limit: 200 }),
                metersApi.getTypes({ limit: 200 }),
                metersApi.getLoops({ limit: 200 }),
            ]);
            setSites(sRes.data.data || []);
            setBuildings(bRes.data.data || []);
            setZones(zRes.data.data || []);
            setBrands(brRes.data.data || []);
            setTypes(tRes.data.data || []);
            setLoops(lRes.data.data || []);
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchLookups(); }, [fetchLookups]);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const manualIdStr = params.get('manual_id');
        if (manualIdStr) {
            const meterId = parseInt(manualIdStr);
            if (!isNaN(meterId)) {
                metersApi.getById(meterId)
                    .then(res => {
                        if (res.data?.data) {
                            handleOpenManualModal(res.data.data);
                        }
                    })
                    .catch(err => console.error('Failed to fetch meter for manual entry:', err))
                    .finally(() => {
                        window.history.replaceState({}, document.title, window.location.pathname);
                    });
            }
        }
    }, []);
    useEffect(() => {
        if (successMsg) {
            const timer = setTimeout(() => setSuccessMsg(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMsg]);

    // Filter buildings by selected site
    const filteredBuildings = form.siteId
        ? buildings.filter(b => b.site_id?.toString() === form.siteId)
        : buildings;

    // Filter lookups for top filter bar
    const filteredFilterBuildings = tempSiteId
        ? buildings.filter(b => b.site_id?.toString() === tempSiteId)
        : buildings;

    const filteredFilterZones = tempBuildingId
        ? zones.filter(z => z.building_id?.toString() === tempBuildingId)
        : zones;

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.meter_id);
        setForm({
            meterCode: row.meter_code || '',
            meterName: row.meter_name || '',
            address: row.address?.toString() || '',
            meterBrandId: row.meter_brand_id?.toString() || '',
            meterTypeId: row.meter_type_id?.toString() || '',
            loopId: row.loop_id?.toString() || '',
            siteId: row.site_id?.toString() || '',
            buildingId: row.building_id?.toString() || '',
            zoneId: row.zone_id?.toString() || '',
            ipAddress: row.ip_address || '',
            portNumber: row.port_number?.toString() || '',
            roomCode: row.room_code || '',
            roomName: row.room_name || '',
            phase: row.phase?.toString() || '',
            circuit: row.circuit?.toString() || '',
            floor: row.floor?.toString() || '',
            status: row.status || 'Manual',
            parentMeterId: row.parent_meter_id?.toString() || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.meterCode.trim()) { setFormError(t('กรุณากรอกรหัสมิเตอร์', 'Meter Code is required')); return; }
        if (!form.meterName.trim()) { setFormError(t('กรุณากรอกชื่อมิเตอร์', 'Meter Name is required')); return; }
        setSaving(true); setFormError('');
        try {
            const payload = {
                ...form,
                address: form.address || null,
                meterBrandId: form.meterBrandId ? parseInt(form.meterBrandId) : null,
                meterTypeId: form.meterTypeId ? parseInt(form.meterTypeId) : null,
                loopId: form.loopId ? parseInt(form.loopId) : null,
                siteId: form.siteId ? parseInt(form.siteId) : null,
                buildingId: form.buildingId ? parseInt(form.buildingId) : null,
                zoneId: form.zoneId ? parseInt(form.zoneId) : null,
                portNumber: form.portNumber ? parseInt(form.portNumber) : null,
                phase: form.phase ? parseInt(form.phase) : null,
                circuit: form.circuit || null,
                floor: form.floor ? parseInt(form.floor) : null,
                status: form.status || 'Manual',
                parentMeterId: form.parentMeterId ? parseInt(form.parentMeterId) : null,
            };
            if (editId) {
                await metersApi.update(editId, payload);
                setSuccessMsg(t('อัปเดตมิเตอร์สำเร็จ!', 'Meter updated successfully!'));
            } else {
                await metersApi.create(payload);
                setSuccessMsg(t('สร้างมิเตอร์สำเร็จ!', 'Meter created successfully!'));
            }
            setShowModal(false); fetchData();
        } catch (err: any) { setFormError(err.response?.data?.message || t('บันทึกมิเตอร์ล้มเหลว', 'Failed to save meter')); }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => { setDeleteTarget(row); setShowDelete(true); };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await metersApi.delete(deleteTarget.meter_id);
            setSuccessMsg(t('ลบมิเตอร์สำเร็จ!', 'Meter deleted successfully!'));
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || t('ลบมิเตอร์ล้มเหลว', 'Failed to delete meter')); }
        setDeleting(false);
    };

    const handleOpenManualModal = (row: any) => {
        setSelectedMeterForManual(row);
        const todayStr = new Date().toLocaleDateString('en-CA');
        setManualDateKeep(todayStr);
        setManualValue('0');
        setManualError('');
        setShowManualModal(true);
    };

    const handleOpenQrModal = (row: any) => {
        setSelectedMeterForQr(row);
        setShowQrModal(true);
    };

    const handlePrintAllQrs = async () => {
        setLoading(true);
        try {
            const params: any = { limit: 9999 };
            if (filterMeterTypeId) params.meterTypeId = filterMeterTypeId;
            if (filterSiteId) params.siteId = filterSiteId;
            if (filterBuildingId) params.buildingId = filterBuildingId;
            if (filterZoneId) params.zoneId = filterZoneId;

            const res = await metersApi.getAll(params);
            const allMeters = res.data.data || [];

            if (allMeters.length === 0) {
                alert(t('ไม่มีข้อมูลมิเตอร์', 'No meter data found'));
                return;
            }

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert(t('กรุณาอนุญาตให้แสดงหน้าต่างป๊อปอัพ', 'Please allow popups for this site'));
                return;
            }

            const cardsHtml = allMeters.map((m: any) => {
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/master/meters?manual_id=${m.meter_id}`)}`;
                return `
                    <div class="qr-card">
                        <img src="${qrUrl}" alt="QR ${m.meter_code}" />
                        <div class="meter-code">${m.meter_code || '—'}</div>
                    </div>
                `;
            }).join('');

            const pageHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>${t('พิมพ์ QR Code ทั้งหมด', 'Print All QR Codes')}</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            margin: 20px;
                            background: #fff;
                            color: #333;
                        }
                        .no-print {
                            margin-bottom: 20px;
                            display: flex;
                            justify-content: flex-end;
                        }
                        .btn {
                            padding: 10px 20px;
                            font-size: 14px;
                            font-weight: 600;
                            border-radius: 4px;
                            border: 1px solid #10b981;
                            background: #10b981;
                            color: white;
                            cursor: pointer;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            transition: opacity 0.2s;
                        }
                        .btn:hover {
                            opacity: 0.9;
                        }
                        .qr-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                            gap: 20px;
                        }
                        .qr-card {
                            border: 1px solid #e1e4e8;
                            border-radius: 8px;
                            padding: 15px;
                            text-align: center;
                            background: #fff;
                            page-break-inside: avoid;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                        }
                        .qr-card img {
                            width: 130px;
                            height: 130px;
                            margin-bottom: 10px;
                            display: block;
                        }
                        .meter-code {
                            font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace;
                            font-size: 13px;
                            font-weight: 700;
                            color: #333;
                            word-break: break-all;
                        }
                        @media print {
                            .no-print {
                                display: none !important;
                            }
                            body {
                                margin: 0;
                            }
                            .qr-grid {
                                grid-template-columns: repeat(4, 1fr);
                                gap: 15px;
                            }
                            .qr-card {
                                border: 1px solid #ddd;
                                box-shadow: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="no-print">
                        <button class="btn" onclick="window.print()">🖨️ ${t('สั่งพิมพ์', 'Print Page')}</button>
                    </div>
                    <div class="qr-grid">
                        ${cardsHtml}
                    </div>
                </body>
                </html>
            `;

            printWindow.document.write(pageHtml);
            printWindow.document.close();
        } catch (err) {
            console.error('Failed to print QR codes:', err);
            alert(t('ไม่สามารถดึงข้อมูลเพื่อพิมพ์ QR Code ได้', 'Failed to fetch QR codes'));
        }
        setLoading(false);
    };

    const handleShowData = () => {
        setFilterMeterTypeId(tempMeterTypeId);
        setFilterSiteId(tempSiteId);
        setFilterBuildingId(tempBuildingId);
        setFilterZoneId(tempZoneId);
        setPage(1);
    };

    const handleOpenManualFromHeader = async () => {
        setSaving(true);
        try {
            const res = await metersApi.getAll({ limit: 9999 });
            setAllMetersForSelect(res.data.data || []);
            setSelectedMeterForManual(null);
            setManualMeterSelectId('');
            const todayStr = new Date().toLocaleDateString('en-CA');
            setManualDateKeep(todayStr);
            setManualValue('0');
            setManualError('');
            setShowManualModal(true);
        } catch (err) {
            console.error(err);
            alert(t('ไม่สามารถโหลดข้อมูลมิเตอร์ได้', 'Failed to load meters'));
        }
        setSaving(false);
    };

    const handleSaveManual = async () => {
        if (!selectedMeterForManual) return;
        if (!manualDateKeep) {
            setManualError(t('กรุณากรอกวันที่ทำรายการ', 'Transaction Date is required'));
            return;
        }
        if (manualValue.trim() === '') {
            setManualError(t('กรุณากรอกค่าพลังงาน', 'Reading Value is required'));
            return;
        }
        
        setManualSaving(true);
        setManualError('');
        try {
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            const isoDateTime = `${manualDateKeep}T${timeStr}`;

            await metersApi.addManualReading(selectedMeterForManual.meter_id, {
                dateKeep: isoDateTime,
                value: parseFloat(manualValue),
            });
            setSuccessMsg(t('บันทึกข้อมูลสำเร็จ!', 'Data saved successfully!'));
            setShowManualModal(false);
        } catch (err: any) {
            setManualError(err.response?.data?.message || t('บันทึกข้อมูลล้มเหลว', 'Failed to save data'));
        }
        setManualSaving(false);
    };

    // ==========================================
    // IMPORT EXCEL LOGIC
    // ==========================================
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const parseExcelFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (rows.length < 2) {
                    alert(t('ไฟล์ไม่มีข้อมูล', 'File contains no data'));
                    return;
                }

                // Parse rows (skip header row 0)
                const parsed: ParsedMeter[] = [];
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    // Skip empty rows (check if address column C has a value)
                    if (row[2] === undefined || row[2] === null || row[2] === '') continue;

                    parsed.push({
                        address: row[2] != null ? String(row[2]).trim() : '',     // C: Address
                        circuit: row[4] != null ? String(row[4]) : '',             // E: circuit
                        building: row[5] != null ? String(row[5]).trim() : '',      // F: อาคาร
                        zone: row[6] != null ? String(row[6]).trim() : '',         // G: Zone
                        meterType: row[7] != null ? String(row[7]).trim() : '',    // H: ประเภทมิเตอร์
                        meterCode: row[8] != null ? String(row[8]).trim() : '',    // I: รหัสมิเตอร์
                        meterName: row[9] != null ? String(row[9]).trim() : '',    // J: ชื่อมิเตอร์
                        roomCode: row[10] != null ? String(row[10]).trim() : '',   // K: รหัสห้อง
                        roomName: row[11] != null ? String(row[11]).trim() : '',   // L: ชื่อห้อง
                        loop: row[12] != null ? Number(row[12]) : null,            // M: Loop
                        meterModel: row[13] != null ? String(row[13]).trim() : '', // N: Meter Model
                        portNumber: row[14] != null ? Number(row[14]) : null,      // O: Port
                        ipAddress: row[15] != null ? String(row[15]).trim() : '',   // P: IP Converter
                        phase: row[16] != null ? Number(row[16]) : null,           // Q: Phase
                        floor: row[17] != null ? Number(row[17]) : null,           // R: ชั้น
                    });
                }

                if (parsed.length === 0) {
                    alert(t('ไม่พบข้อมูลมิเตอร์ในไฟล์', 'No meter data found in file'));
                    return;
                }

                setParsedMeters(parsed);
                setImportFileName(file.name);
                setShowImportPreview(true);
            } catch (err) {
                console.error(err);
                alert(t('ไม่สามารถอ่านไฟล์ Excel ได้', 'Failed to read Excel file'));
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            parseExcelFile(file);
        }
        // Reset file input so same file can be selected again
        e.target.value = '';
    };

    const handleConfirmImport = async () => {
        setImporting(true);
        try {
            const res = await metersApi.importMeters(parsedMeters);
            setImportResult(res.data.data);
            setShowImportPreview(false);
            setShowImportResult(true);
            fetchData();
            fetchLookups();
        } catch (err: any) {
            alert(err.response?.data?.message || t('นำเข้าข้อมูลล้มเหลว', 'Import failed'));
        }
        setImporting(false);
    };

    // Import summary stats
    const importSummary = {
        total: parsedMeters.length,
        buildings: [...new Set(parsedMeters.map(m => m.building).filter(Boolean))],
        zones: [...new Set(parsedMeters.map(m => m.zone).filter(Boolean))],
        meterTypes: [...new Set(parsedMeters.map(m => m.meterType).filter(Boolean))],
        meterModels: [...new Set(parsedMeters.map(m => m.meterModel).filter(Boolean))],
        loops: [...new Set(parsedMeters.map(m => m.loop).filter(v => v !== null))],
    };

    const columns = [
        { key: 'meter_code', title: t('รหัส', 'Code') },
        { key: 'meter_name', title: t('ชื่อมิเตอร์', 'Meter Name') },
        { key: 'address', title: t('Address', 'Address') },
        { key: 'site_name', title: t('ไซต์', 'Site') },
        { key: 'building_name', title: t('อาคาร', 'Building') },
        { key: 'zone_name', title: t('โซน', 'Zone') },
        { key: 'meter_type_name', title: t('ประเภท', 'Type') },
        {
            key: 'meter_brand_name', title: t('แบรนด์', 'Brand'),
            render: (v: string) => v ? <span className="badge badge-info">{v}</span> : '—',
        },
        { key: 'ip_address', title: 'IP', render: (v: string) => v ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> : '—' },
        { key: 'port_number', title: t('พอร์ต', 'Port') },
        { key: 'room_code', title: t('รหัสห้อง', 'Room Code') },
        { key: 'room_name', title: t('ชื่อห้อง', 'Room Name') },
        { key: 'phase', title: t('เฟส', 'Phase') },
        { key: 'circuit', title: t('วงจร', 'Circuit') },
        { key: 'floor', title: t('ชั้น', 'Floor') },
        {
            key: 'is_active', title: t('สถานะ', 'Status'),
            render: (v: boolean) => <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>{v ? t('ใช้งาน', 'Active') : t('ไม่ใช้งาน', 'Inactive')}</span>,
        },
        {
            key: 'actions', title: t('จัดการ', 'Actions'),
            render: (_: any, row: any) => (
                <div className="table-actions" style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => handleOpenQrModal(row)} title={t('แสดง QR Code สำหรับบันทึกข้อมูล', 'Show QR Code')}>📷 {t('QR Code', 'QR')}</button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleOpenManualModal(row)} title={t('บันทึกข้อมูลแบบ Manual', 'Manual Entry')}>📝 {t('บันทึกข้อมูล', 'Manual')}</button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>✏️ {t('แก้ไข', 'Edit')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>🗑️ {t('ลบ', 'Delete')}</button>
                </div>
            ),
        },
    ];

    // Preview columns for import
    const previewColumns = [
        { label: '#', width: '40px' },
        { label: t('รหัสมิเตอร์', 'Meter Code'), width: 'auto' },
        { label: t('ชื่อมิเตอร์', 'Meter Name'), width: 'auto' },
        { label: t('อาคาร', 'Building'), width: 'auto' },
        { label: t('โซน', 'Zone'), width: 'auto' },
        { label: t('รหัสห้อง', 'Room Code'), width: 'auto' },
        { label: 'IP', width: '120px' },
        { label: t('Address', 'Address'), width: '60px' },
        { label: t('เฟส', 'Phase'), width: '50px' },
        { label: t('ชั้น', 'Floor'), width: '50px' },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '10px 0 20px 0' }}>{t('มิเตอร์', 'Meters')}</h2>

            {/* Filter Bar Panel */}
            <div style={{
                background: 'var(--bg-secondary, #1c232e)',
                border: '1px solid var(--border, #2a313c)',
                padding: '16px 20px',
                borderRadius: 8,
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontWeight: 600, fontSize: 14 }}>{t('ประเภท', 'Type')}</label>
                    <select
                        className="form-control"
                        style={{ width: 140, height: 36, padding: '0 8px' }}
                        value={tempMeterTypeId}
                        onChange={e => setTempMeterTypeId(e.target.value)}
                    >
                        <option value="">— {t('ทั้งหมด', 'All')} —</option>
                        {types.map(t => <option key={t.meter_type_id} value={t.meter_type_id}>{t.meter_type_name}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontWeight: 600, fontSize: 14 }}>{t('สถานที่', 'Location')}</label>
                    <select
                        className="form-control"
                        style={{ width: 140, height: 36, padding: '0 8px' }}
                        value={tempSiteId}
                        onChange={e => { setTempSiteId(e.target.value); setTempBuildingId(''); setTempZoneId(''); }}
                    >
                        <option value="">All Site</option>
                        {sites.map(s => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
                    </select>

                    <select
                        className="form-control"
                        style={{ width: 140, height: 36, padding: '0 8px' }}
                        value={tempBuildingId}
                        onChange={e => { setTempBuildingId(e.target.value); setTempZoneId(''); }}
                    >
                        <option value="">All Building</option>
                        {filteredFilterBuildings.map(b => <option key={b.building_id} value={b.building_id}>{b.building_name}</option>)}
                    </select>

                    <select
                        className="form-control"
                        style={{ width: 140, height: 36, padding: '0 8px' }}
                        value={tempZoneId}
                        onChange={e => setTempZoneId(e.target.value)}
                    >
                        <option value="">All Zone</option>
                        {filteredFilterZones.map(z => <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>)}
                    </select>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleShowData}
                    style={{
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'var(--accent, #2b4c7e)',
                        fontWeight: 600,
                        border: 'none',
                        padding: '0 16px'
                    }}
                >
                    🔄 {t('Show Data', 'Show Data')}
                </button>
            </div>

            {/* Actions Bar Panel */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                    className="btn btn-success"
                    onClick={handleCreate}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#22c55e', color: '#fff', border: 'none',
                        fontWeight: 600, fontSize: 13, padding: '8px 16px'
                    }}
                >
                    ➕ {t('Create New', 'Create New')}
                </button>
                <button
                    className="btn"
                    onClick={handleImportClick}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#0ea5e9', color: '#fff', border: 'none',
                        fontWeight: 600, fontSize: 13, padding: '8px 16px'
                    }}
                >
                    📄 {t('Import Meter', 'Import Meter')}
                </button>
                <button
                    className="btn"
                    onClick={handlePrintAllQrs}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#1e293b', color: '#fff', border: 'none',
                        fontWeight: 600, fontSize: 13, padding: '8px 16px'
                    }}
                >
                    🔳 {t('Show QR', 'Show QR')}
                </button>
                <button
                    className="btn"
                    onClick={handleOpenManualFromHeader}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#eab308', color: '#fff', border: 'none',
                        fontWeight: 600, fontSize: 13, padding: '8px 16px'
                    }}
                >
                    📝 {t('Add Manual', 'Add Manual')}
                </button>

                {/* Download Template button styled cleanly at the end */}
                <button
                    className="btn btn-outline"
                    onClick={() => {
                        // Generate template Excel file
                        const headers = [
                            'No.', 'Status', 'Address', 'Loop', 'Circuit', 'Building', 'Zone',
                            'Meter Type', 'Meter Code', 'Meter Name', 'Room Code', 'Room Name',
                            'Loop No.', 'Meter Model', 'Port', 'IP Address', 'Phase', 'Floor'
                        ];
                        const sampleRow = [
                            1, '', 1, 1, 'MDB-01', '111PMT_Building A', 'Common_A',
                            'ELE', 'MTR-001', 'Main Meter', 'R-101', 'Room 101',
                            1, 'MPR-47S', 23, '192.168.1.100', 3, 1,
                        ];
                        const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
                        ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Meter Import Template');
                        XLSX.writeFile(wb, 'meter_import_template.xlsx');
                    }}
                    style={{
                        marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
                        border: '1px solid var(--text-muted)', color: 'var(--text-muted)',
                        fontWeight: 600, fontSize: 13, padding: '8px 16px'
                    }}
                >
                    📄 {t('ดาวน์โหลด Template', 'Download Template')}
                </button>
            </div>

            <DataTable title={t('มิเตอร์', 'Meters')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />

            {/* Create/Edit Modal — larger size */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? t('แก้ไขมิเตอร์', 'Edit Meter') : t('เพิ่มมิเตอร์ใหม่', 'Add New Meter')} size="lg"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}

                {/* Basic Info */}
                <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ข้อมูลพื้นฐาน', 'Basic Information')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('รหัสมิเตอร์', 'Meter Code')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="text" className="form-control" placeholder={t('เช่น MTR-001', 'e.g. MTR-001')} value={form.meterCode} onChange={e => setForm({ ...form, meterCode: e.target.value })} autoFocus />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('ชื่อมิเตอร์', 'Meter Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="text" className="form-control" placeholder={t('เช่น มิเตอร์ไฟฟ้าหลัก', 'e.g. Main Electricity Meter')} value={form.meterName} onChange={e => setForm({ ...form, meterName: e.target.value })} />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('ประเภทมิเตอร์', 'Meter Type')}</label>
                        <select className="form-control" value={form.meterTypeId} onChange={e => setForm({ ...form, meterTypeId: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {types.map(t => <option key={t.meter_type_id} value={t.meter_type_id}>{t.meter_type_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('แบรนด์', 'Brand')}</label>
                        <select className="form-control" value={form.meterBrandId} onChange={e => setForm({ ...form, meterBrandId: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {brands.map(b => <option key={b.meter_brand_id} value={b.meter_brand_id}>{b.meter_brand_name}{b.model_name ? ` — ${b.model_name}` : ''}</option>)}
                        </select>
                    </div>
                </div>

                {/* Location */}
                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('สถานที่', 'Location')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('ไซต์', 'Site')}</label>
                        <select className="form-control" value={form.siteId} onChange={e => setForm({ ...form, siteId: e.target.value, buildingId: '' })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {sites.map(s => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('อาคาร', 'Building')}</label>
                        <select className="form-control" value={form.buildingId} onChange={e => setForm({ ...form, buildingId: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {filteredBuildings.map(b => <option key={b.building_id} value={b.building_id}>{b.building_name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('โซน', 'Zone')}</label>
                        <select className="form-control" value={form.zoneId} onChange={e => setForm({ ...form, zoneId: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {zones.map(z => <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('รหัสห้อง', 'Room Code')}</label>
                        <input type="text" className="form-control" placeholder={t('รหัสห้อง', 'Room code')} value={form.roomCode} onChange={e => setForm({ ...form, roomCode: e.target.value })} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">{t('ชื่อห้อง', 'Room Name')}</label>
                    <input type="text" className="form-control" placeholder={t('ชื่อห้อง', 'Room name')} value={form.roomName} onChange={e => setForm({ ...form, roomName: e.target.value })} />
                </div>

                {/* Communication */}
                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('การสื่อสาร', 'Communication')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('ลูป', 'Loop')}</label>
                        <select className="form-control" value={form.loopId} onChange={e => setForm({ ...form, loopId: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {loops.map(l => <option key={l.loop_id} value={l.loop_id}>{l.port_no} ({l.baudrate})</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('ที่อยู่ Modbus', 'Modbus Address')}</label>
                        <input type="text" className="form-control" placeholder={t('เช่น 1', 'e.g. 1')} maxLength={10} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('ที่อยู่ IP', 'IP Address')}</label>
                        <input type="text" className="form-control" placeholder={t('เช่น 192.168.1.100', 'e.g. 192.168.1.100')} value={form.ipAddress} onChange={e => setForm({ ...form, ipAddress: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('หมายเลขพอร์ต', 'Port Number')}</label>
                        <input type="number" className="form-control" placeholder={t('เช่น 502', 'e.g. 502')} value={form.portNumber} onChange={e => setForm({ ...form, portNumber: e.target.value })} />
                    </div>
                </div>

                {/* Electrical */}
                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ระบบไฟฟ้า', 'Electrical')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('เฟส', 'Phase')}</label>
                        <select className="form-control" value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            <option value="1">{t('1 เฟส', '1 Phase')}</option>
                            <option value="3">{t('3 เฟส', '3 Phase')}</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('วงจร (Circuit)', 'Circuit')}</label>
                        <input type="text" className="form-control" placeholder={t('เช่น MDB-01', 'e.g. MDB-01')} maxLength={50} value={form.circuit} onChange={e => setForm({ ...form, circuit: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('ชั้น', 'Floor')}</label>
                        <input type="number" className="form-control" placeholder={t('เช่น 1', 'e.g. 1')} value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('มิเตอร์หลัก', 'Parent Meter')}</label>
                        <select className="form-control" value={form.parentMeterId} onChange={e => setForm({ ...form, parentMeterId: e.target.value })}>
                            <option value="">— {t('ไม่มี', 'None')} —</option>
                            {data.filter(m => m.meter_id !== editId).map(m => <option key={m.meter_id} value={m.meter_id}>{m.meter_code} — {m.meter_name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Status */}
                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('สถานะ', 'Status')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('สถานะ', 'Status')}</label>
                        <select className="form-control" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                            <option value="Manual">Manual</option>
                            <option value="Auto">Auto</option>
                            <option value="Offline">Offline</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24 }}>
                            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                            {t('ใช้งาน', 'Active')}
                        </label>
                    </div>
                </div>
            </Modal>

            {/* Delete */}
            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title={t('ยืนยันการลบ', 'Confirm Delete')} size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}</button></div>}
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ลบมิเตอร์', 'Delete meter')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.meter_code} — {deleteTarget?.meter_name}"</p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>{t('ข้อมูลประวัติทั้งหมดของมิเตอร์นี้จะยังคงอยู่ แต่อาจขาดการเชื่อมโยง', 'All historical data for this meter will remain but may become orphaned.')}</p>
                </div>
            </Modal>

            {/* ==========================================
                IMPORT PREVIEW MODAL
                ========================================== */}
            <Modal
                isOpen={showImportPreview}
                onClose={() => setShowImportPreview(false)}
                title={`📥 ${t('ตรวจสอบข้อมูลก่อนนำเข้า', 'Review Import Data')}`}
                size="lg"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowImportPreview(false)} disabled={importing}>
                            {t('ยกเลิก', 'Cancel')}
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleConfirmImport}
                            disabled={importing}
                            style={{ background: '#10b981', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            {importing ? (
                                <>{t('กำลังนำเข้า...', 'Importing...')}</>
                            ) : (
                                <>✅ {t('ยืนยันนำเข้า', 'Confirm Import')} ({parsedMeters.length} {t('รายการ', 'records')})</>
                            )}
                        </button>
                    </div>
                }
            >
                {/* File name */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                    padding: '10px 14px', background: 'var(--bg-secondary, #1c232e)',
                    borderRadius: 6, border: '1px solid var(--border, #2a313c)',
                }}>
                    <span style={{ fontSize: 20 }}>📄</span>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{importFileName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {parsedMeters.length} {t('แถวข้อมูล', 'data rows')} | Sheet1
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10, marginBottom: 16,
                }}>
                    {[
                        { label: t('มิเตอร์ทั้งหมด', 'Total Meters'), value: importSummary.total, icon: '⚡', color: '#3b82f6' },
                        { label: t('อาคาร', 'Buildings'), value: importSummary.buildings.length, icon: '🏢', color: '#8b5cf6' },
                        { label: t('โซน', 'Zones'), value: importSummary.zones.length, icon: '📍', color: '#f59e0b' },
                        { label: t('ประเภท', 'Types'), value: importSummary.meterTypes.length, icon: '🔌', color: '#10b981' },
                        { label: t('รุ่น/แบรนด์', 'Models'), value: importSummary.meterModels.length, icon: '🏭', color: '#ef4444' },
                        { label: t('ลูป', 'Loops'), value: importSummary.loops.length, icon: '🔄', color: '#06b6d4' },
                    ].map((card, idx) => (
                        <div key={idx} style={{
                            padding: '12px', borderRadius: 8,
                            background: `${card.color}15`,
                            border: `1px solid ${card.color}30`,
                            textAlign: 'center',
                        }}>
                            <div style={{ fontSize: 22 }}>{card.icon}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
                        </div>
                    ))}
                </div>

                {/* Master Data that will be auto-created */}
                <div style={{
                    padding: '10px 14px', marginBottom: 16,
                    background: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: 6,
                }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#f59e0b' }}>
                        ⚡ {t('Master Data ที่จะถูกสร้างอัตโนมัติ (ถ้ายังไม่มีในระบบ)', 'Master Data will be auto-created if not existing')}
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                        <div><strong>{t('อาคาร', 'Buildings')}:</strong> {importSummary.buildings.join(', ') || '—'}</div>
                        <div><strong>{t('โซน', 'Zones')}:</strong> {importSummary.zones.join(', ') || '—'}</div>
                        <div><strong>{t('ประเภท', 'Types')}:</strong> {importSummary.meterTypes.join(', ') || '—'}</div>
                        <div><strong>{t('รุ่น', 'Models')}:</strong> {importSummary.meterModels.join(', ') || '—'}</div>
                    </div>
                </div>

                {/* Column Mapping */}
                <div style={{
                    padding: '10px 14px', marginBottom: 16,
                    background: 'var(--bg-secondary, #1c232e)', border: '1px solid var(--border, #2a313c)', borderRadius: 6,
                }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--accent)' }}>
                        🔗 {t('การ Mapping คอลัมน์', 'Column Mapping')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', fontSize: 12 }}>
                        {[
                            ['C: Address', '→ address (Modbus)'],
                            ['E: circuit', '→ circuit'],
                            ['F: อาคาร', '→ building_id (lookup)'],
                            ['G: Zone', '→ zone_id (lookup)'],
                            ['H: ประเภท', '→ meter_type_id (lookup)'],
                            ['I: รหัสมิเตอร์', '→ meter_code'],
                            ['J: ชื่อมิเตอร์', '→ meter_name'],
                            ['K: รหัสห้อง', '→ room_code'],
                            ['L: ชื่อห้อง', '→ room_name'],
                            ['M: Loop', '→ loop_id (lookup)'],
                            ['N: Meter Model', '→ meter_brand_id (lookup)'],
                            ['O: Port', '→ port_number'],
                            ['P: IP', '→ ip_address'],
                            ['Q: Phase', '→ phase'],
                            ['R: ชั้น', '→ floor'],
                        ].map(([from, to], idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border, #2a313c)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{from}</span>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>{to}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Data Preview Table */}
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--accent)' }}>
                    📋 {t('ตัวอย่างข้อมูล', 'Data Preview')} ({t('แสดง 10 แถวแรก', 'showing first 10 rows')})
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 300, borderRadius: 6, border: '1px solid var(--border, #2a313c)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 800 }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-tertiary, #23261e)', position: 'sticky', top: 0 }}>
                                {previewColumns.map((col, idx) => (
                                    <th key={idx} style={{
                                        padding: '7px 10px', fontWeight: 700, fontSize: 10.5,
                                        letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap',
                                        borderBottom: '2px solid var(--accent)',
                                        width: col.width,
                                    }}>{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {parsedMeters.slice(0, 10).map((m, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border, #2a313c)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary, #1c232e)' }}>
                                    <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                    <td style={{ padding: '6px 10px', fontWeight: 600, fontFamily: 'monospace' }}>{m.meterCode}</td>
                                    <td style={{ padding: '6px 10px' }}>{m.meterName}</td>
                                    <td style={{ padding: '6px 10px' }}>{m.building}</td>
                                    <td style={{ padding: '6px 10px' }}>
                                        <span style={{
                                            background: '#8b5cf620', color: '#a78bfa',
                                            padding: '2px 6px', borderRadius: 4, fontSize: 10.5,
                                        }}>{m.zone}</span>
                                    </td>
                                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 11 }}>{m.roomCode}</td>
                                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 11 }}>{m.ipAddress}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>{m.address}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>{m.phase}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>{m.floor}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {parsedMeters.length > 10 && (
                    <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                        ... {t('และอีก', 'and')} {parsedMeters.length - 10} {t('แถว', 'more rows')}
                    </div>
                )}
            </Modal>

            {/* ==========================================
                IMPORT RESULT MODAL
                ========================================== */}
            <Modal
                isOpen={showImportResult}
                onClose={() => { setShowImportResult(false); setImportResult(null); }}
                title={`${importResult?.imported > 0 ? '✅' : '⚠️'} ${t('ผลการนำเข้า', 'Import Results')}`}
                size="md"
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={() => { setShowImportResult(false); setImportResult(null); }}>
                            {t('ปิด', 'Close')}
                        </button>
                    </div>
                }
            >
                {importResult && (
                    <div style={{ padding: '8px 0' }}>
                        {/* Result Summary */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16,
                        }}>
                            <div style={{ textAlign: 'center', padding: 16, borderRadius: 8, background: '#10b98115', border: '1px solid #10b98130' }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{importResult.imported}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>{t('นำเข้าใหม่', 'Inserted')}</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: 16, borderRadius: 8, background: '#3b82f615', border: '1px solid #3b82f630' }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6' }}>{importResult.updated || 0}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6' }}>{t('อัปเดต', 'Updated')}</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: 16, borderRadius: 8, background: '#f59e0b15', border: '1px solid #f59e0b30' }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{importResult.skipped}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>{t('ข้าม', 'Skipped')}</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: 16, borderRadius: 8, background: '#ef444415', border: '1px solid #ef444430' }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>{importResult.errors?.length || 0}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>{t('ข้อผิดพลาด', 'Errors')}</div>
                            </div>
                        </div>

                        {/* Created Master Data */}
                        {importResult.createdMasterData && (
                            <div style={{
                                padding: '10px 14px', marginBottom: 12,
                                background: '#8b5cf615', border: '1px solid #8b5cf630', borderRadius: 6,
                            }}>
                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#8b5cf6' }}>
                                    🆕 {t('Master Data ที่สร้างใหม่', 'Newly Created Master Data')}
                                </div>
                                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                                    {importResult.createdMasterData.sites?.length > 0 && (
                                        <div>📍 <strong>{t('ไซต์', 'Sites')}:</strong> {importResult.createdMasterData.sites.join(', ')}</div>
                                    )}
                                    {importResult.createdMasterData.buildings?.length > 0 && (
                                        <div>🏢 <strong>{t('อาคาร', 'Buildings')}:</strong> {importResult.createdMasterData.buildings.join(', ')}</div>
                                    )}
                                    {importResult.createdMasterData.zones?.length > 0 && (
                                        <div>📍 <strong>{t('โซน', 'Zones')}:</strong> {importResult.createdMasterData.zones.join(', ')}</div>
                                    )}
                                    {importResult.createdMasterData.meterTypes?.length > 0 && (
                                        <div>🔌 <strong>{t('ประเภท', 'Types')}:</strong> {importResult.createdMasterData.meterTypes.join(', ')}</div>
                                    )}
                                    {importResult.createdMasterData.meterBrands?.length > 0 && (
                                        <div>🏭 <strong>{t('รุ่น', 'Brands')}:</strong> {importResult.createdMasterData.meterBrands.join(', ')}</div>
                                    )}
                                    {importResult.createdMasterData.loops?.length > 0 && (
                                        <div>🔄 <strong>{t('ลูป', 'Loops')}:</strong> Loop {importResult.createdMasterData.loops.join(', ')}</div>
                                    )}
                                    {Object.values(importResult.createdMasterData).every((v: any) => !v?.length) && (
                                        <div style={{ color: 'var(--text-muted)' }}>{t('ไม่มี — ข้อมูล Master ทั้งหมดมีอยู่แล้ว', 'None — all master data already existed')}</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Error details */}
                        {importResult.errors?.length > 0 && (
                            <div style={{
                                padding: '10px 14px',
                                background: '#ef444415', border: '1px solid #ef444430', borderRadius: 6,
                                maxHeight: 200, overflowY: 'auto',
                            }}>
                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#ef4444' }}>
                                    ⚠️ {t('รายละเอียดข้อผิดพลาด', 'Error Details')}
                                </div>
                                {importResult.errors.map((err: any, idx: number) => (
                                    <div key={idx} style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px solid #ef444420' }}>
                                        <strong>{t('แถว', 'Row')} {err.row}:</strong> {err.message}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Manual Entry Modal */}
            <Modal
                isOpen={showManualModal}
                onClose={() => { setShowManualModal(false); setSelectedMeterForManual(null); setManualMeterSelectId(''); }}
                title={t('Add Manual', 'Add Manual')}
                size="md"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => { setShowManualModal(false); setSelectedMeterForManual(null); setManualMeterSelectId(''); }} disabled={manualSaving}>
                            {t('ยกเลิก', 'Cancel')}
                        </button>
                        <button className="btn btn-primary" onClick={handleSaveManual} disabled={manualSaving} style={{ background: 'var(--accent, #2b4c7e)' }}>
                            {manualSaving ? t('กำลังบันทึก...', 'Saving...') : t('Save', 'Save')}
                        </button>
                    </div>
                }
            >
                {manualError && <div className="form-error-banner" style={{ marginBottom: 12 }}>{manualError}</div>}

                {!selectedMeterForManual && (
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('เลือกมิเตอร์', 'Select Meter')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <select
                            className="form-control"
                            value={manualMeterSelectId}
                            onChange={(e) => {
                                const mId = e.target.value;
                                setManualMeterSelectId(mId);
                                const found = allMetersForSelect.find(m => m.meter_id.toString() === mId);
                                if (found) {
                                    setSelectedMeterForManual(found);
                                }
                            }}
                        >
                            <option value="">— {t('เลือกมิเตอร์', 'Select Meter')} —</option>
                            {allMetersForSelect.map(m => (
                                <option key={m.meter_id} value={m.meter_id}>
                                    {m.meter_code} — {m.meter_name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('รหัสมิเตอร์', 'Meter Code')}</label>
                        <input type="text" className="form-control" value={selectedMeterForManual?.meter_code || ''} disabled style={{ backgroundColor: 'var(--bg-secondary, #f1efe3)', opacity: 0.8 }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('ชื่อมิเตอร์', 'Meter Name')}</label>
                        <input type="text" className="form-control" value={selectedMeterForManual?.meter_name || ''} disabled style={{ backgroundColor: 'var(--bg-secondary, #f1efe3)', opacity: 0.8 }} />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('อาคาร', 'Building')}</label>
                        <input type="text" className="form-control" value={selectedMeterForManual?.building_name || ''} disabled style={{ backgroundColor: 'var(--bg-secondary, #f1efe3)', opacity: 0.8 }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('โซน', 'Zone')}</label>
                        <input type="text" className="form-control" value={selectedMeterForManual?.zone_name || ''} disabled style={{ backgroundColor: 'var(--bg-secondary, #f1efe3)', opacity: 0.8 }} />
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>{t('วันที่ทำรายการ', 'Transaction Date')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="date" className="form-control" value={manualDateKeep} onChange={e => setManualDateKeep(e.target.value)} />
                </div>

                <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                        {selectedMeterForManual?.meter_type_id === 2
                            ? t('ค่าน้ำ (ลบ.ม.)', 'Water Reading (m³)')
                            : selectedMeterForManual?.meter_type_id === 3
                            ? t('ค่าแก๊ส (ลบ.ม.)', 'Gas Reading (m³)')
                            : t('ค่าพลังงาน (kWh)', 'Energy Value (kWh)')} <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                        type="number"
                        step="any"
                        className="form-control"
                        placeholder="0"
                        value={manualValue}
                        onChange={e => setManualValue(e.target.value)}
                        autoFocus
                    />
                </div>
            </Modal>

            {/* QR Code Modal */}
            <Modal
                isOpen={showQrModal}
                onClose={() => setShowQrModal(false)}
                title={t('QR Code สำหรับลงบันทึกข้อมูล', 'QR Code for Manual Entry')}
                size="sm"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', width: '100%' }}>
                        <button className="btn btn-outline" onClick={() => setShowQrModal(false)}>
                            {t('ปิด', 'Close')}
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                if (!selectedMeterForQr) return;
                                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/master/meters?manual_id=${selectedMeterForQr.meter_id}`)}`;
                                fetch(qrUrl)
                                    .then(response => response.blob())
                                    .then(blob => {
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `QR_Meter_${selectedMeterForQr.meter_code || selectedMeterForQr.meter_id}.png`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        window.URL.revokeObjectURL(url);
                                    })
                                    .catch(err => console.error('Error downloading QR code:', err));
                            }}
                            style={{ background: 'var(--success, #10b981)', borderColor: 'var(--success, #10b981)' }}
                        >
                            📥 {t('ดาวน์โหลด QR', 'Download QR')}
                        </button>
                    </div>
                }
            >
                {selectedMeterForQr && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px 0' }}>
                        <div style={{
                            padding: 16,
                            background: '#fff',
                            borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            marginBottom: 16,
                            display: 'inline-block'
                        }}>
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/master/meters?manual_id=${selectedMeterForQr.meter_id}`)}`}
                                alt={`QR Code for Meter ${selectedMeterForQr.meter_code}`}
                                style={{ width: 200, height: 200, display: 'block' }}
                            />
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                            {selectedMeterForQr.meter_code}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                            {selectedMeterForQr.meter_name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {selectedMeterForQr.building_name ? `🏢 ${selectedMeterForQr.building_name}` : ''} 
                            {selectedMeterForQr.zone_name ? ` 📍 ${selectedMeterForQr.zone_name}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, wordBreak: 'break-all', fontFamily: 'monospace', maxWidth: '100%', opacity: 0.7 }}>
                            {`${window.location.origin}/master/meters?manual_id=${selectedMeterForQr.meter_id}`}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default MetersPage;
