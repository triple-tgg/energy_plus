import { query } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';

export class BillingService {
    async getBillingConfigs(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query(`SELECT COUNT(*) FROM billing_config`);
        const total = parseInt(countResult.rows[0].count);
        const result = await query(`SELECT * FROM billing_config ORDER BY id DESC LIMIT $1 OFFSET $2`, [limit, offset]);
        return { data: result.rows, total, page, limit };
    }
    async createBillingConfig(data: any) {
        const result = await query(
            `INSERT INTO billing_config (effective_date, unit_price, is_active, created_by, created_on)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
            [data.effectiveDate, data.unitPrice, true, data.createdBy]
        );
        return result.rows[0];
    }
    async updateBillingConfig(id: number, data: any) {
        const result = await query(
            `UPDATE billing_config SET effective_date=$1, unit_price=$2, is_active=$3,
       last_modified_by=$4, last_modified_on=NOW() WHERE id=$5 RETURNING *`,
            [data.effectiveDate, data.unitPrice, data.isActive, data.modifiedBy, id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Billing config not found');
        return result.rows[0];
    }
    async deleteBillingConfig(id: number) {
        const result = await query(`DELETE FROM billing_config WHERE id=$1 RETURNING id`, [id]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Billing config not found');
        return result.rows[0];
    }
}

export class DemandService {
    async getDemandConfigs(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query(`SELECT COUNT(*) FROM demand_peak_config`);
        const total = parseInt(countResult.rows[0].count);
        const result = await query(`SELECT * FROM demand_peak_config ORDER BY config_id DESC LIMIT $1 OFFSET $2`, [limit, offset]);
        return { data: result.rows, total, page, limit };
    }
    async createDemandConfig(data: any) {
        const result = await query(
            `INSERT INTO demand_peak_config (display_name, warning_setpoint, peak_setpoint, saving_rate, flat_rate, tou, saving_target, is_active, created_by, created_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING *`,
            [data.displayName, data.warningSetpoint, data.peakSetpoint, data.savingRate, data.flatRate, data.tou, data.savingTarget, true, data.createdBy]
        );
        return result.rows[0];
    }
    async updateDemandConfig(id: number, data: any) {
        const result = await query(
            `UPDATE demand_peak_config SET display_name=$1, warning_setpoint=$2, peak_setpoint=$3, saving_rate=$4,
       flat_rate=$5, tou=$6, saving_target=$7, is_active=$8, last_modified_by=$9, last_modified_on=NOW()
       WHERE config_id=$10 RETURNING *`,
            [data.displayName, data.warningSetpoint, data.peakSetpoint, data.savingRate, data.flatRate, data.tou, data.savingTarget, data.isActive, data.modifiedBy, id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Config not found');
        return result.rows[0];
    }
    async deleteDemandConfig(id: number) {
        const result = await query(`DELETE FROM demand_peak_config WHERE config_id=$1 RETURNING config_id`, [id]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Config not found');
        return result.rows[0];
    }
}
