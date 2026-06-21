import { query, getClient } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';

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

        const countResult = await query(`SELECT COUNT(*) FROM meter m ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        params.push(limit, offset);
        const result = await query(
            `SELECT m.*, mb.meter_brand_name, mt.meter_type_name, s.site_name,
              b.building_name, z.zone_name
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
            `SELECT m.*, mb.meter_brand_name, mt.meter_type_name, s.site_name, b.building_name, z.zone_name
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
        const result = await query(
            `INSERT INTO meter (meter_code, meter_name, address, meter_brand_id, meter_type_id, loop_id,
       site_id, building_id, zone_id, is_active, ip_address, port_number, room_code, room_name,
       phase, circuit, created_by, created_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW()) RETURNING *`,
            [data.meterCode, data.meterName, data.address, data.meterBrandId, data.meterTypeId, data.loopId,
            data.siteId, data.buildingId, data.zoneId, true, data.ipAddress, data.portNumber,
            data.roomCode, data.roomName, data.phase, data.circuit, data.createdBy]
        );
        return result.rows[0];
    }

    async updateMeter(meterId: number, data: any) {
        const result = await query(
            `UPDATE meter SET meter_code=$1, meter_name=$2, address=$3, meter_brand_id=$4, meter_type_id=$5,
       loop_id=$6, site_id=$7, building_id=$8, zone_id=$9, is_active=$10, ip_address=$11,
       port_number=$12, room_code=$13, room_name=$14, phase=$15, circuit=$16,
       last_modified_by=$17, last_modified_on=NOW()
       WHERE meter_id=$18 RETURNING *`,
            [data.meterCode, data.meterName, data.address, data.meterBrandId, data.meterTypeId, data.loopId,
            data.siteId, data.buildingId, data.zoneId, data.isActive, data.ipAddress, data.portNumber,
            data.roomCode, data.roomName, data.phase, data.circuit, data.modifiedBy, meterId]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Meter not found');
        return result.rows[0];
    }

    async deleteMeter(meterId: number) {
        const result = await query(`DELETE FROM meter WHERE meter_id = $1 RETURNING meter_id`, [meterId]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Meter not found');
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
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Brand not found');
        return result.rows[0];
    }
    async deleteBrand(id: number) {
        const result = await query(`DELETE FROM meter_brand WHERE meter_brand_id=$1 RETURNING meter_brand_id`, [id]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Brand not found');
        return result.rows[0];
    }

    // Types
    async getTypes(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query(`SELECT COUNT(*) FROM meter_type`);
        const total = parseInt(countResult.rows[0].count);
        const result = await query(`SELECT * FROM meter_type ORDER BY meter_type_id LIMIT $1 OFFSET $2`, [limit, offset]);
        return { data: result.rows, total, page, limit };
    }
    async createType(data: any) {
        const result = await query(
            `INSERT INTO meter_type (meter_type_name, icon_name, is_active, created_by, created_on)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
            [data.meterTypeName, data.iconName, true, data.createdBy]
        );
        return result.rows[0];
    }
    async updateType(id: number, data: any) {
        const result = await query(
            `UPDATE meter_type SET meter_type_name=$1, icon_name=$2, is_active=$3,
       last_modified_by=$4, last_modified_on=NOW() WHERE meter_type_id=$5 RETURNING *`,
            [data.meterTypeName, data.iconName, data.isActive, data.modifiedBy, id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Type not found');
        return result.rows[0];
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

            // Ensure phase, circuit, floor columns exist
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS phase INTEGER`);
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS circuit VARCHAR(50)`);
            await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS floor INTEGER`);
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
            existingBuildings.rows.forEach((r: any) => buildingCache.set(r.building_name, r.building_id));

            const existingZones = await client.query(`SELECT zone_id, zone_name, building_id FROM zones`);
            existingZones.rows.forEach((r: any) => zoneCache.set(r.zone_name, r.zone_id));

            const existingTypes = await client.query(`SELECT meter_type_id, meter_type_name FROM meter_type`);
            existingTypes.rows.forEach((r: any) => meterTypeCache.set(r.meter_type_name, r.meter_type_id));

            const existingBrands = await client.query(`SELECT meter_brand_id, meter_brand_name, model_name FROM meter_brand`);
            existingBrands.rows.forEach((r: any) => {
                meterBrandCache.set(r.model_name || r.meter_brand_name, r.meter_brand_id);
            });

            const existingLoops = await client.query(`SELECT loop_id, port_no FROM loop`);
            existingLoops.rows.forEach((r: any) => loopCache.set(r.port_no, r.loop_id));

            // Helper: get or create site
            const getOrCreateSite = async (siteName: string): Promise<number | null> => {
                if (!siteName) return null;
                if (siteCache.has(siteName)) return siteCache.get(siteName)!;
                const res = await client.query(
                    `INSERT INTO sites (site_name, created_by) VALUES ($1, $2) RETURNING site_id`,
                    [siteName, createdBy]
                );
                const id = res.rows[0].site_id;
                siteCache.set(siteName, id);
                results.createdMasterData.sites.push(siteName);
                return id;
            };

            // Helper: get or create building (linked to site)
            const getOrCreateBuilding = async (buildingName: string, siteId: number | null): Promise<number | null> => {
                if (!buildingName) return null;
                if (buildingCache.has(buildingName)) return buildingCache.get(buildingName)!;
                const res = await client.query(
                    `INSERT INTO buildings (building_name, site_id, created_by) VALUES ($1, $2, $3) RETURNING building_id`,
                    [buildingName, siteId, createdBy]
                );
                const id = res.rows[0].building_id;
                buildingCache.set(buildingName, id);
                results.createdMasterData.buildings.push(buildingName);
                return id;
            };

            // Helper: get or create zone (linked to building)
            const getOrCreateZone = async (zoneName: string, buildingId: number | null): Promise<number | null> => {
                if (!zoneName) return null;
                if (zoneCache.has(zoneName)) return zoneCache.get(zoneName)!;
                const res = await client.query(
                    `INSERT INTO zones (zone_name, building_id) VALUES ($1, $2) RETURNING zone_id`,
                    [zoneName, buildingId]
                );
                const id = res.rows[0].zone_id;
                zoneCache.set(zoneName, id);
                results.createdMasterData.zones.push(zoneName);
                return id;
            };

            // Helper: get or create meter type
            const getOrCreateMeterType = async (typeName: string): Promise<number | null> => {
                if (!typeName) return null;
                if (meterTypeCache.has(typeName)) return meterTypeCache.get(typeName)!;
                const res = await client.query(
                    `INSERT INTO meter_type (meter_type_name, is_active) VALUES ($1, true) RETURNING meter_type_id`,
                    [typeName]
                );
                const id = res.rows[0].meter_type_id;
                meterTypeCache.set(typeName, id);
                results.createdMasterData.meterTypes.push(typeName);
                return id;
            };

            // Helper: get or create meter brand (by model_name)
            const getOrCreateMeterBrand = async (modelName: string): Promise<number | null> => {
                if (!modelName) return null;
                if (meterBrandCache.has(modelName)) return meterBrandCache.get(modelName)!;
                const res = await client.query(
                    `INSERT INTO meter_brand (meter_brand_name, model_name, is_active) VALUES ($1, $2, true) RETURNING meter_brand_id`,
                    [modelName, modelName]
                );
                const id = res.rows[0].meter_brand_id;
                meterBrandCache.set(modelName, id);
                results.createdMasterData.meterBrands.push(modelName);
                return id;
            };

            // Helper: get or create loop (by loop number)
            const getOrCreateLoop = async (loopNo: number): Promise<number | null> => {
                if (!loopNo && loopNo !== 0) return null;
                if (loopCache.has(loopNo)) return loopCache.get(loopNo)!;
                const res = await client.query(
                    `INSERT INTO loop (loop_name, port_no, baudrate, is_active) VALUES ($1, $2, 9600, true) RETURNING loop_id`,
                    [`Loop ${loopNo}`, loopNo]
                );
                const id = res.rows[0].loop_id;
                loopCache.set(loopNo, id);
                results.createdMasterData.loops.push(loopNo);
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
                    const siteName = deriveSiteName(row.building || '');
                    const siteId = await getOrCreateSite(siteName);
                    const buildingId = await getOrCreateBuilding(row.building, siteId);
                    const zoneId = await getOrCreateZone(row.zone, buildingId);
                    const meterTypeId = await getOrCreateMeterType(row.meterType);
                    const meterBrandId = await getOrCreateMeterBrand(row.meterModel);
                    const loopId = await getOrCreateLoop(row.loop);

                    // Check for existing meter by ip_address + address (composite key)
                    const ipAddr = row.ipAddress || null;
                    const modbusAddr = row.address || null;
                    let existingId: number | null = null;

                    if (ipAddr && modbusAddr !== null) {
                        const existing = await client.query(
                            `SELECT meter_id FROM meter WHERE ip_address = $1 AND address = $2`,
                            [ipAddr, modbusAddr]
                        );
                        if (existing.rows.length > 0) {
                            existingId = existing.rows[0].meter_id;
                        }
                    }

                    if (existingId) {
                        // UPDATE existing meter
                        await client.query(
                            `UPDATE meter SET meter_code=$1, meter_name=$2, meter_brand_id=$3, meter_type_id=$4, loop_id=$5,
                             site_id=$6, building_id=$7, zone_id=$8, ip_address=$9, port_number=$10, room_code=$11, room_name=$12,
                             phase=$13, circuit=$14, floor=$15, last_modified_by=$16, last_modified_on=NOW()
                             WHERE meter_id=$17`,
                            [
                                String(row.meterCode || '').trim(),
                                row.meterName || '',
                                meterBrandId,
                                meterTypeId,
                                loopId,
                                siteId,
                                buildingId,
                                zoneId,
                                ipAddr,
                                row.portNumber || null,
                                row.roomCode || null,
                                row.roomName || null,
                                row.phase || null,
                                row.circuit || null,
                                row.floor || null,
                                createdBy,
                                existingId,
                            ]
                        );
                        results.updated++;
                    } else {
                        // INSERT new meter
                        await client.query(
                            `INSERT INTO meter (meter_code, meter_name, address, meter_brand_id, meter_type_id, loop_id,
                             site_id, building_id, zone_id, is_active, ip_address, port_number, room_code, room_name,
                             phase, circuit, floor, created_by, created_on)
                             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11,$12,$13,$14,$15,$16,$17,NOW())`,
                            [
                                String(row.meterCode || '').trim(),
                                row.meterName || '',
                                row.address || null,
                                meterBrandId,
                                meterTypeId,
                                loopId,
                                siteId,
                                buildingId,
                                zoneId,
                                ipAddr,
                                row.portNumber || null,
                                row.roomCode || null,
                                row.roomName || null,
                                row.phase || null,
                                row.circuit || null,
                                row.floor || null,
                                createdBy,
                            ]
                        );
                        results.imported++;
                    }
                } catch (err: any) {
                    results.errors.push({ row: i + 1, message: err.message });
                }
            }

            await client.query('COMMIT');
        } catch (err: any) {
            await client.query('ROLLBACK');
            throw new AppError(500, 'IMPORT_FAILED', `Import failed: ${err.message}`);
        } finally {
            client.release();
        }

        return results;
    }
}

