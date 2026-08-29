import { query, getClient } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';
import { syncMeterSubscriptions } from '../redis-pubsub/redisPubsub.service';
import { licenseService } from '../license/license.service';

const refreshMeterSubscriptions = async (): Promise<void> => {
    try {
        await syncMeterSubscriptions();
    } catch (error: any) {
        // The meter write has already succeeded. Periodic reconciliation will retry.
        console.error('❌ Failed to refresh Redis meter subscriptions:', error.message);
    }
};

const buildRealtimeChannel = (project: string, siteEl: number, loopNo: number | null | undefined): string => {
    const projectKey = String(project || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
    const loopKey = loopNo || 1;
    return `${projectKey || 'project'}_${siteEl}_${loopKey}`;
};

export class MetersService {
    async getMeters(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const { siteId, buildingId, zoneId, meterTypeId, search } = queryParams;
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];

        if (siteId) { params.push(parseInt(siteId)); whereClause += ` AND m.site_id = $${params.length}`; }
        if (buildingId) { params.push(parseInt(buildingId)); whereClause += ` AND m.building_id = $${params.length}`; }
        if (zoneId) { params.push(parseInt(zoneId)); whereClause += ` AND m.zone_id = $${params.length}`; }
        if (meterTypeId) { params.push(parseInt(meterTypeId)); whereClause += ` AND m.meter_type_id = $${params.length}`; }
        if (search) { params.push(`%${search}%`); whereClause += ` AND (m.meter_name ILIKE $${params.length} OR m.meter_code ILIKE $${params.length})`; }
        if (queryParams.activeOnly === true || queryParams.activeOnly === 'true') {
            whereClause += ' AND m.is_active = true';
        }

        const countResult = await query(`SELECT COUNT(*) FROM meter m ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        params.push(limit, offset);
        const result = await query(
            `SELECT m.*, mb.meter_brand_name, mt.meter_type_name, mt.icon_name, s.site_name, s.site_name_th, s.site_name_en,
              b.building_name, b.building_name_th, b.building_name_en, z.zone_name
       FROM meter m
       LEFT JOIN meter_brand mb ON m.meter_brand_id = mb.meter_brand_id
       LEFT JOIN meter_type mt ON m.meter_type_id = mt.meter_type_id
       LEFT JOIN sites s ON m.site_id = s.site_id
       LEFT JOIN buildings b ON m.building_id = b.building_id
       LEFT JOIN zones z ON m.zone_id = z.zone_id
       ${whereClause}
       ORDER BY m.meter_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        return { data: result.rows, total, page, limit };
    }

    async getMeterById(meterId: number) {
        const result = await query(
            `SELECT m.*, mb.meter_brand_name, mt.meter_type_name, mt.icon_name, s.site_name, s.site_name_th, s.site_name_en,
              b.building_name, b.building_name_th, b.building_name_en, z.zone_name
       FROM meter m
       LEFT JOIN meter_brand mb ON m.meter_brand_id = mb.meter_brand_id
       LEFT JOIN meter_type mt ON m.meter_type_id = mt.meter_type_id
       LEFT JOIN sites s ON m.site_id = s.site_id
       LEFT JOIN buildings b ON m.building_id = b.building_id
       LEFT JOIN zones z ON m.zone_id = z.zone_id
       WHERE m.meter_id = $1`, [meterId]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Meter not found');
        return result.rows[0];
    }

    async createMeter(data: any) {
        // Enforce cryptographic license meter quota (every meter counts, active or not)
        const quota = await licenseService.checkMeterQuota(1);
        if (!quota.allowed) {
            throw new AppError(
                403,
                'LICENSE_LIMIT_EXCEEDED',
                `ไม่สามารถเพิ่มมิเตอร์ได้ เนื่องจากครบโควตา License แล้ว (${quota.current}/${quota.max} ตัว) กรุณาอัปเกรด License Key เพื่อเพิ่มจำนวนมิเตอร์`
            );
        }

        const result = await query(
            `INSERT INTO meter (meter_code, meter_name, address, meter_brand_id, meter_type_id, loop_id,
       site_id, building_id, zone_id, is_active, ip_address, port_number, room_code, room_name,
       phase, circuit, floor, status, parent_meter_id, site_el, created_by, created_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW()) RETURNING *`,
            [data.meterCode, data.meterName, data.address, data.meterBrandId, data.meterTypeId, data.loopId,
            data.siteId, data.buildingId, data.zoneId, data.isActive ?? true, data.ipAddress, data.portNumber,
            data.roomCode, data.roomName, data.phase, data.circuit, data.floor,
            data.status || 'Manual', data.parentMeterId || null, data.siteEl ?? null, data.createdBy]
        );
        await refreshMeterSubscriptions();
        return result.rows[0];
    }

    async updateMeter(meterId: number, data: any) {
        // No quota check here: an existing meter already consumes quota whether active or not

        const result = await query(
            `UPDATE meter SET meter_code=$1, meter_name=$2, address=$3, meter_brand_id=$4, meter_type_id=$5,
       loop_id=$6, site_id=$7, building_id=$8, zone_id=$9, is_active=$10, ip_address=$11,
       port_number=$12, room_code=$13, room_name=$14, phase=$15, circuit=$16,
       floor=$17, status=$18, parent_meter_id=$19, last_modified_by=$20,
       site_el=COALESCE($21, site_el), last_modified_on=NOW()
       WHERE meter_id=$22 RETURNING *`,
            [data.meterCode, data.meterName, data.address, data.meterBrandId, data.meterTypeId, data.loopId,
            data.siteId, data.buildingId, data.zoneId, data.isActive, data.ipAddress, data.portNumber,
            data.roomCode, data.roomName, data.phase, data.circuit,
            data.floor, data.status || 'Manual', data.parentMeterId || null, data.modifiedBy,
            data.siteEl ?? null, meterId]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Meter not found');
        await refreshMeterSubscriptions();
        return result.rows[0];
    }

    async deleteMeter(meterId: number) {
        const result = await query(`DELETE FROM meter WHERE meter_id = $1 RETURNING meter_id`, [meterId]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Meter not found');
        await refreshMeterSubscriptions();
        return result.rows[0];
    }

    // Brands
    async getBrands(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query(`SELECT COUNT(*) FROM meter_brand`);
        const total = parseInt(countResult.rows[0].count);
        const result = await query(`SELECT * FROM meter_brand ORDER BY meter_brand_id LIMIT $1 OFFSET $2`, [limit, offset]);
        return { data: result.rows, total, page, limit };
    }
    async createBrand(data: any) {
        const result = await query(
            `INSERT INTO meter_brand (meter_brand_name, model_name, notes, is_active, created_by, created_on)
       VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
            [data.meterBrandName, data.modelName, data.notes, true, data.createdBy]
        );
        return result.rows[0];
    }
    async updateBrand(id: number, data: any) {
        const result = await query(
            `UPDATE meter_brand SET meter_brand_name=$1, model_name=$2, notes=$3, is_active=$4,
       last_modified_by=$5, last_modified_on=NOW() WHERE meter_brand_id=$6 RETURNING *`,
            [data.meterBrandName, data.modelName, data.notes, data.isActive, data.modifiedBy, id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Model not found');
        return result.rows[0];
    }
    async deleteBrand(id: number) {
        const result = await query(`DELETE FROM meter_brand WHERE meter_brand_id=$1 RETURNING meter_brand_id`, [id]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Model not found');
        return result.rows[0];
    }

    // Types
    async getTypes(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const activeOnly = queryParams.activeOnly === true || queryParams.activeOnly === 'true';
        const whereClause = activeOnly ? 'WHERE is_active = true' : '';
        const countResult = await query(`SELECT COUNT(*) FROM meter_type ${whereClause}`);
        const total = parseInt(countResult.rows[0].count);
        const result = await query(
            `SELECT * FROM meter_type ${whereClause} ORDER BY meter_type_id LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return { data: result.rows, total, page, limit };
    }
    async createType(data: any) {
        try {
            const result = await query(
                `INSERT INTO meter_type (meter_type_name, icon_name, is_active, created_by, created_on)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
                [data.meterTypeName, data.iconName || null, data.isActive !== false, data.createdBy || null]
            );
            return result.rows[0];
        } catch (err: any) {
            // Fallback: table might not have created_by/created_on columns
            if (err.message?.includes('column') && (err.message?.includes('created_by') || err.message?.includes('created_on'))) {
                const result = await query(
                    `INSERT INTO meter_type (meter_type_name, icon_name, is_active)
           VALUES ($1,$2,$3) RETURNING *`,
                    [data.meterTypeName, data.iconName || null, data.isActive !== false]
                );
                return result.rows[0];
            }
            throw err;
        }
    }
    async updateType(id: number, data: any) {
        try {
            const result = await query(
                `UPDATE meter_type SET meter_type_name=$1, icon_name=$2, is_active=$3,
       last_modified_by=$4, last_modified_on=NOW() WHERE meter_type_id=$5 RETURNING *`,
                [data.meterTypeName, data.iconName || null, data.isActive, data.modifiedBy || null, id]
            );
            if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Type not found');
            return result.rows[0];
        } catch (err: any) {
            // Fallback: table might not have last_modified_by/last_modified_on columns
            if (err.message?.includes('column') && (err.message?.includes('last_modified') || err.message?.includes('modified'))) {
                const result = await query(
                    `UPDATE meter_type SET meter_type_name=$1, icon_name=$2, is_active=$3
           WHERE meter_type_id=$4 RETURNING *`,
                    [data.meterTypeName, data.iconName || null, data.isActive, id]
                );
                if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Type not found');
                return result.rows[0];
            }
            throw err;
        }
    }
    async deleteType(id: number) {
        const result = await query(`DELETE FROM meter_type WHERE meter_type_id=$1 RETURNING meter_type_id`, [id]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Type not found');
        return result.rows[0];
    }

    // Loops
    async getLoops(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query(`SELECT COUNT(*) FROM loop`);
        const total = parseInt(countResult.rows[0].count);
        const result = await query(`SELECT * FROM loop ORDER BY loop_id LIMIT $1 OFFSET $2`, [limit, offset]);
        return { data: result.rows, total, page, limit };
    }
    async createLoop(data: any) {
        const result = await query(
            `INSERT INTO loop (port_no, baudrate, stopbit, parity, databit, is_active, remark)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [data.portNo, data.baudrate, data.stopbit, data.parity, data.databit, true, data.remark]
        );
        return result.rows[0];
    }
    async updateLoop(id: number, data: any) {
        const result = await query(
            `UPDATE loop SET port_no=$1, baudrate=$2, stopbit=$3, parity=$4, databit=$5,
       is_active=$6, remark=$7 WHERE loop_id=$8 RETURNING *`,
            [data.portNo, data.baudrate, data.stopbit, data.parity, data.databit, data.isActive, data.remark, id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Loop not found');
        return result.rows[0];
    }
    async deleteLoop(id: number) {
        const result = await query(`DELETE FROM loop WHERE loop_id=$1 RETURNING loop_id`, [id]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Loop not found');
        return result.rows[0];
    }

    // Energy Values
    async getEnergyValues() {
        const result = await query(`SELECT * FROM energy_value ORDER BY energy_value_id`);
        return result.rows;
    }

    // ==========================================
    // IMPORT from Excel — auto-create master data
    // ==========================================
    async importMeters(meters: any[], createdBy: string) {
        const client = await getClient();
        const results = {
            imported: 0,
            updated: 0,
            skipped: 0,
            errors: [] as { row: number; message: string }[],
            createdMasterData: {
                sites: [] as string[],
                buildings: [] as string[],
                zones: [] as string[],
                meterTypes: [] as string[],
                meterBrands: [] as string[],
                loops: [] as number[],
            },
        };

        try {
            await client.query('BEGIN');

            // Ensure phase, circuit, floor, meter_group, max_kwh, subaddress, converter columns exist
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS phase VARCHAR(20)`);
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS circuit VARCHAR(100)`);
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS floor INTEGER`);
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS meter_group VARCHAR(100)`);
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS max_kwh DECIMAL(18,2)`);
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS subaddress INTEGER`);
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS converter VARCHAR(100)`);
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS site VARCHAR(200)`);
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS site_el INTEGER`);
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(100)`);

            // Cache for lookups — keyed by name, value is DB id
            const siteCache = new Map<string, number>();
            const buildingCache = new Map<string, number>();
            const zoneCache = new Map<string, number>();
            const meterTypeCache = new Map<string, number>();
            const meterBrandCache = new Map<string, number>();
            const loopCache = new Map<number, number>();

            // Pre-load existing lookups
            const existingSites = await client.query(`SELECT site_id, site_name FROM sites`);
            existingSites.rows.forEach((r: any) => siteCache.set(r.site_name, r.site_id));

            const existingBuildings = await client.query(`SELECT building_id, building_name, site_id FROM buildings`);
            existingBuildings.rows.forEach((r: any) => buildingCache.set(`${r.site_id || ''}_${r.building_name}`, r.building_id));

            const existingZones = await client.query(`SELECT zone_id, zone_name, building_id FROM zones`);
            existingZones.rows.forEach((r: any) => zoneCache.set(`${r.building_id || ''}_${r.zone_name}`, r.zone_id));

            const existingTypes = await client.query(`SELECT meter_type_id, meter_type_name FROM meter_type`);
            existingTypes.rows.forEach((r: any) => meterTypeCache.set(r.meter_type_name, r.meter_type_id));

            const existingBrands = await client.query(`SELECT meter_brand_id, meter_brand_name, model_name FROM meter_brand`);
            existingBrands.rows.forEach((r: any) => {
                if (r.model_name) meterBrandCache.set(r.model_name, r.meter_brand_id);
                if (r.meter_brand_name) meterBrandCache.set(r.meter_brand_name, r.meter_brand_id);
            });

            const existingLoops = await client.query(`SELECT loop_id, port_no FROM loop`);
            existingLoops.rows.forEach((r: any) => loopCache.set(r.port_no, r.loop_id));

            // Helper: get or create site
            const getOrCreateSite = async (siteName: string): Promise<number | null> => {
                if (!siteName) return null;
                const trimmed = siteName.trim();
                if (siteCache.has(trimmed)) return siteCache.get(trimmed)!;
                const res = await client.query(
                    `INSERT INTO sites (site_name, created_by) VALUES ($1, $2) RETURNING site_id`,
                    [trimmed, createdBy]
                );
                const id = res.rows[0].site_id;
                siteCache.set(trimmed, id);
                results.createdMasterData.sites.push(trimmed);
                return id;
            };

            // Helper: get or create building (linked to site)
            const getOrCreateBuilding = async (buildingName: string, siteId: number | null): Promise<number | null> => {
                if (!buildingName) return null;
                const trimmed = buildingName.trim();
                const cacheKey = `${siteId || ''}_${trimmed}`;
                if (buildingCache.has(cacheKey)) return buildingCache.get(cacheKey)!;
                const res = await client.query(
                    `INSERT INTO buildings (building_name, site_id, created_by) VALUES ($1, $2, $3) RETURNING building_id`,
                    [trimmed, siteId, createdBy]
                );
                const id = res.rows[0].building_id;
                buildingCache.set(cacheKey, id);
                results.createdMasterData.buildings.push(trimmed);
                return id;
            };

            // Helper: get or create zone (linked to building)
            const getOrCreateZone = async (zoneName: string, buildingId: number | null): Promise<number | null> => {
                if (!zoneName) return null;
                const trimmed = zoneName.trim();
                const cacheKey = `${buildingId || ''}_${trimmed}`;
                if (zoneCache.has(cacheKey)) return zoneCache.get(cacheKey)!;
                const res = await client.query(
                    `INSERT INTO zones (zone_name, building_id) VALUES ($1, $2) RETURNING zone_id`,
                    [trimmed, buildingId]
                );
                const id = res.rows[0].zone_id;
                zoneCache.set(cacheKey, id);
                results.createdMasterData.zones.push(zoneName);
                return id;
            };

            // Helper: get or create meter type
            const getOrCreateMeterType = async (typeName: string): Promise<number | null> => {
                if (!typeName) return null;
                const trimmed = typeName.trim();
                if (meterTypeCache.has(trimmed)) return meterTypeCache.get(trimmed)!;
                const res = await client.query(
                    `INSERT INTO meter_type (meter_type_name, is_active) VALUES ($1, true) RETURNING meter_type_id`,
                    [trimmed]
                );
                const id = res.rows[0].meter_type_id;
                meterTypeCache.set(trimmed, id);
                results.createdMasterData.meterTypes.push(trimmed);
                return id;
            };

            // Helper: get or create meter brand & model
            const getOrCreateMeterBrand = async (brandName: string, modelName: string): Promise<number | null> => {
                const bName = (brandName || '').trim();
                const mName = (modelName || '').trim();
                const lookupKey = mName || bName;
                if (!lookupKey) return null;

                if (meterBrandCache.has(lookupKey)) return meterBrandCache.get(lookupKey)!;

                const brandToInsert = bName || mName || 'Generic';
                const modelToInsert = mName || bName || 'Standard';

                const res = await client.query(
                    `INSERT INTO meter_brand (meter_brand_name, model_name, is_active) VALUES ($1, $2, true) RETURNING meter_brand_id`,
                    [brandToInsert, modelToInsert]
                );
                const id = res.rows[0].meter_brand_id;
                if (mName) meterBrandCache.set(mName, id);
                if (bName) meterBrandCache.set(bName, id);
                results.createdMasterData.meterBrands.push(`${brandToInsert} ${modelToInsert}`);
                return id;
            };

            // Helper: get or create loop (by loop number)
            const getOrCreateLoop = async (loopNo: number | null): Promise<number | null> => {
                if (loopNo === null || loopNo === undefined || isNaN(Number(loopNo))) return null;
                const loopNum = Number(loopNo);
                if (loopCache.has(loopNum)) return loopCache.get(loopNum)!;
                const res = await client.query(
                    `INSERT INTO loop (loop_name, port_no, baudrate, is_active) VALUES ($1, $2, 9600, true) RETURNING loop_id`,
                    [`Loop ${loopNum}`, loopNum]
                );
                const id = res.rows[0].loop_id;
                loopCache.set(loopNum, id);
                results.createdMasterData.loops.push(loopNum);
                return id;
            };

            // Derive site name from building name (e.g. "111PMT_Building A" → "111PMT")
            const deriveSiteName = (buildingName: string): string => {
                if (!buildingName) return '';
                const parts = buildingName.split('_');
                return parts.length > 1 ? parts[0] : buildingName;
            };

            // Process each meter row
            for (let i = 0; i < meters.length; i++) {
                const row = meters[i];
                try {
                    // Resolve lookups — auto-create if not found
                    const siteName = String(row.siteName || '').trim() || deriveSiteName(row.building || '') || 'Main Site';
                    const meterSite = siteName;

                    // Parse siteEl (e.g. "1000_1" -> site_el: 1000, or numeric 1000)
                    let meterSiteEl: number | null = null;
                    let derivedAddressFromEl: string | null = null;
                    if (row.siteEl !== null && row.siteEl !== undefined && row.siteEl !== '') {
                        const strEl = String(row.siteEl).trim();
                        if (strEl.includes('_')) {
                            const [sPart, aPart] = strEl.split('_');
                            const sNum = parseInt(sPart, 10);
                            if (Number.isFinite(sNum)) meterSiteEl = sNum;
                            if (aPart) derivedAddressFromEl = aPart;
                        } else {
                            const sNum = parseInt(strEl, 10);
                            if (Number.isFinite(sNum)) meterSiteEl = sNum;
                        }
                    }

                    const buildingName = String(row.building || '').trim() || 'Building 1';
                    const zoneName = String(row.zone || '').trim() || 'General Zone';
                    const meterTypeName = String(row.meterType || '').trim() || 'ELE';

                    const siteId = await getOrCreateSite(siteName);
                    const buildingId = await getOrCreateBuilding(buildingName, siteId);
                    const zoneId = await getOrCreateZone(zoneName, buildingId);
                    const meterTypeId = await getOrCreateMeterType(meterTypeName);
                    const meterBrandId = await getOrCreateMeterBrand(row.meterName || '', row.meterModel || '');
                    const loopId = await getOrCreateLoop(row.loop);

                    // Address handling
                    let modbusAddr = row.address !== null && row.address !== undefined && row.address !== ''
                        ? String(row.address).trim()
                        : derivedAddressFromEl;

                    if (!modbusAddr) {
                        modbusAddr = String(i + 1);
                    }

                    // Meter Code generation if empty
                    let meterCode = String(row.meterCode || '').trim();
                    if (!meterCode) {
                        if (row.roomCode) {
                            meterCode = String(row.roomCode).trim();
                        } else {
                            meterCode = `${siteName}_M${modbusAddr}`;
                        }
                    }

                    // Meter Name handling
                    let meterName = String(row.meterName || '').trim();
                    if (!meterName) {
                        meterName = String(row.roomName || '').trim() || String(row.meterModel || '').trim() || `Meter ${modbusAddr}`;
                    }

                    const ipAddr = row.ipAddress ? String(row.ipAddress).trim() : null;
                    const portNumber = row.portNumber ? Number(row.portNumber) : null;
                    const subAddress = row.subaddress !== null && row.subaddress !== undefined && row.subaddress !== ''
                        ? Number(row.subaddress)
                        : null;
                    const meterGroup = row.meterGroup ? String(row.meterGroup).trim() : null;
                    const maxKwh = row.maxKwh !== null && row.maxKwh !== undefined && row.maxKwh !== ''
                        ? Number(row.maxKwh)
                        : null;
                    const converter = row.converter ? String(row.converter).trim() : null;
                    const status = row.status ? String(row.status).trim() : 'Manual';
                    const phase = row.phase !== null && row.phase !== undefined && row.phase !== ''
                        ? String(row.phase).trim()
                        : null;
                    const circuit = row.circuit ? String(row.circuit).trim() : null;
                    const floor = row.floor !== null && row.floor !== undefined && row.floor !== ''
                        ? Number(row.floor)
                        : null;

                    // Check for existing meter by meter_code first, then (site_id, address) or (ip_address, address)
                    let existingId: number | null = null;
                    if (meterCode) {
                        const existing = await client.query(
                            `SELECT meter_id FROM meter WHERE meter_code = $1`,
                            [meterCode]
                        );
                        if (existing.rows.length > 0) {
                            existingId = existing.rows[0].meter_id;
                        }
                    }

                    if (!existingId && modbusAddr !== null) {
                        if (siteId) {
                            const existing = await client.query(
                                `SELECT meter_id FROM meter WHERE site_id = $1 AND address = $2`,
                                [siteId, modbusAddr]
                            );
                            if (existing.rows.length > 0) {
                                existingId = existing.rows[0].meter_id;
                            }
                        }
                    }

                    let savedMeterId: number | null = existingId;

                    if (existingId) {
                        // UPDATE existing meter
                        await client.query(
                            `UPDATE meter SET
                                meter_code=$1, meter_name=$2, meter_brand_id=$3, meter_type_id=$4, loop_id=$5,
                                site_id=$6, building_id=$7, zone_id=$8, ip_address=$9, port_number=$10,
                                room_code=$11, room_name=$12, phase=$13, circuit=$14, floor=$15,
                                site=$16, site_el=$17, meter_group=$18, max_kwh=$19, subaddress=$20,
                                converter=$21, status=$22, last_modified_by=$23, last_modified_on=NOW()
                             WHERE meter_id=$24`,
                            [
                                meterCode,
                                meterName,
                                meterBrandId,
                                meterTypeId,
                                loopId,
                                siteId,
                                buildingId,
                                zoneId,
                                ipAddr,
                                portNumber,
                                row.roomCode || null,
                                row.roomName || null,
                                phase,
                                circuit,
                                floor,
                                meterSite,
                                meterSiteEl,
                                meterGroup,
                                maxKwh,
                                subAddress,
                                converter,
                                status,
                                createdBy,
                                existingId,
                            ]
                        );
                        results.updated++;
                    } else {
                        // INSERT new meter
                        const inserted = await client.query(
                            `INSERT INTO meter (
                                meter_code, meter_name, address, meter_brand_id, meter_type_id, loop_id,
                                site_id, building_id, zone_id, is_active, ip_address, port_number,
                                room_code, room_name, phase, circuit, floor, site, site_el,
                                meter_group, max_kwh, subaddress, converter, status, created_by, created_on
                             )
                             VALUES (
                                $1, $2, $3, $4, $5, $6,
                                $7, $8, $9, true, $10, $11,
                                $12, $13, $14, $15, $16, $17, $18,
                                $19, $20, $21, $22, $23, $24, NOW()
                             )
                             RETURNING meter_id`,
                            [
                                meterCode,
                                meterName,
                                modbusAddr,
                                meterBrandId,
                                meterTypeId,
                                loopId,
                                siteId,
                                buildingId,
                                zoneId,
                                ipAddr,
                                portNumber,
                                row.roomCode || null,
                                row.roomName || null,
                                phase,
                                circuit,
                                floor,
                                meterSite,
                                meterSiteEl,
                                meterGroup,
                                maxKwh,
                                subAddress,
                                converter,
                                status,
                                createdBy,
                            ]
                        );
                        savedMeterId = inserted.rows[0]?.meter_id || null;
                        results.imported++;
                    }

                    if (savedMeterId && row.siteEl && modbusAddr !== null) {
                        const realtimeSiteId = Number(row.siteEl);
                        const realtimeAddressId = Number(modbusAddr);
                        const realtimeChannel = buildRealtimeChannel(siteName, realtimeSiteId, row.loop);
                        if (Number.isFinite(realtimeSiteId) && Number.isFinite(realtimeAddressId)) {
                            await client.query(
                                `UPDATE realtime_meter_map
                                 SET is_active = false, updated_at = NOW()
                                 WHERE meter_id = $1
                                   AND NOT (realtime_site_id = $2 AND realtime_address_id = $3 AND channel = $4)`,
                                [savedMeterId, realtimeSiteId, realtimeAddressId, realtimeChannel]
                            );

                            const existingMap = await client.query(
                                `SELECT id FROM realtime_meter_map
                                 WHERE realtime_site_id = $1
                                   AND realtime_address_id = $2
                                   AND channel = $3
                                 LIMIT 1`,
                                [realtimeSiteId, realtimeAddressId, realtimeChannel]
                            );

                            if (existingMap.rows.length > 0) {
                                await client.query(
                                    `UPDATE realtime_meter_map
                                     SET meter_id = $1, is_active = true, updated_at = NOW()
                                     WHERE id = $2`,
                                    [savedMeterId, existingMap.rows[0].id]
                                );
                            } else {
                                await client.query(
                                    `INSERT INTO realtime_meter_map (
                                        channel, realtime_site_id, realtime_address_id, meter_id, is_active, created_at, updated_at
                                     )
                                     VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
                                    [realtimeChannel, realtimeSiteId, realtimeAddressId, savedMeterId]
                                );
                            }
                        }
                    }

                    const readingValue = row.currentKwh && Number(row.currentKwh) > 0
                        ? Number(row.currentKwh)
                        : row.previousKwh && Number(row.previousKwh) > 0
                            ? Number(row.previousKwh)
                            : null;
                    if (savedMeterId && readingValue !== null) {
                        await client.query(
                            `INSERT INTO actual_meter_data (meter_id, date_keep, energy_kwh, status)
                             VALUES ($1, NOW(), $2, 'online')`,
                            [savedMeterId, readingValue]
                        );
                        await client.query(
                            `INSERT INTO actual_meter_data_daily (meter_id, date_keep, total_kwh, max_kw, min_kw, avg_kw)
                             VALUES ($1, CURRENT_DATE, $2, 0, 0, 0)
                             ON CONFLICT (meter_id, date_keep) DO UPDATE SET total_kwh = EXCLUDED.total_kwh`,
                            [savedMeterId, readingValue]
                        );
                        await client.query(
                            `INSERT INTO actual_meter_data_monthly (meter_id, year_month, total_kwh, max_kw, avg_kw)
                             VALUES ($1, to_char(CURRENT_DATE, 'YYYY-MM'), $2, 0, 0)
                             ON CONFLICT (meter_id, year_month) DO UPDATE SET total_kwh = EXCLUDED.total_kwh`,
                            [savedMeterId, readingValue]
                        );
                    }
                } catch (err: any) {
                    results.errors.push({ row: i + 1, message: err.message });
                }
            }

            await client.query('COMMIT');
            await refreshMeterSubscriptions();
        } catch (err: any) {
            await client.query('ROLLBACK');
            throw new AppError(500, 'IMPORT_FAILED', `Import failed: ${err.message}`);
        } finally {
            client.release();
        }

        return results;
    }

    async addManualReading(meterId: number, data: any) {
        const meter = await this.getMeterById(meterId);
        
        let valueColumn = 'energy_kwh';
        // Map based on meter_type_id (1: Electricity/ไฟฟ้า, 2: Water/น้ำ, 3: Gas/แก๊ส)
        if (meter.meter_type_id === 2) {
            valueColumn = 'water_value';
        } else if (meter.meter_type_id === 3) {
            valueColumn = 'gas_value';
        }

        const dateKeep = data.dateKeep ? new Date(data.dateKeep) : new Date();
        const value = data.value !== undefined ? parseFloat(data.value) : 0;

        const result = await query(
            `INSERT INTO actual_meter_data (meter_id, date_keep, ${valueColumn}, status)
             VALUES ($1, $2, $3, 'online') RETURNING *`,
            [meterId, dateKeep, value]
        );
        return result.rows[0];
    }
}
