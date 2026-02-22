import { query } from '../../config/database';
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
}
