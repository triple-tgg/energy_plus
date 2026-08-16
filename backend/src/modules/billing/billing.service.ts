import { query } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';

export class BillingService {
    private static schemaEnsured = false;

    private async ensureSchema() {
        if (BillingService.schemaEnsured) return;
        await query(`
            ALTER TABLE billing_config
            ADD COLUMN IF NOT EXISTS rate_mode VARCHAR(20) DEFAULT 'tiered',
            ADD COLUMN IF NOT EXISTS tier1_limit NUMERIC(10, 2) DEFAULT 200.00,
            ADD COLUMN IF NOT EXISTS tier1_rate NUMERIC(10, 4) DEFAULT 3.0000,
            ADD COLUMN IF NOT EXISTS tier2_rate NUMERIC(10, 4) DEFAULT 4.2200,
            ADD COLUMN IF NOT EXISTS service_charge NUMERIC(10, 4) DEFAULT 24.6200,
            ADD COLUMN IF NOT EXISTS ft_rate NUMERIC(10, 4) DEFAULT 0.1623,
            ADD COLUMN IF NOT EXISTS vat_percent NUMERIC(5, 2) DEFAULT 7.00
        `);

        // Check if there is any record; if empty, insert default tiered rate matching Sheet 1
        const countRes = await query(`SELECT COUNT(*)::int AS count FROM billing_config`);
        if (countRes.rows[0]?.count === 0) {
            await query(`
                INSERT INTO billing_config (
                    effective_date, unit_price, rate_mode, tier1_limit,
                    tier1_rate, tier2_rate, service_charge, ft_rate, vat_percent,
                    is_active, created_by, created_on
                ) VALUES (
                    '2026-01-01', 4.1500, 'tiered', 200.00,
                    3.0000, 4.2200, 24.6200, 0.1623, 7.00,
                    true, 'system', NOW()
                )
            `);
        } else {
            // Update existing records with default tier values if NULL
            await query(`
                UPDATE billing_config SET
                    rate_mode = COALESCE(rate_mode, 'tiered'),
                    tier1_limit = COALESCE(tier1_limit, 200.00),
                    tier1_rate = COALESCE(tier1_rate, 3.0000),
                    tier2_rate = COALESCE(tier2_rate, 4.2200),
                    service_charge = COALESCE(service_charge, 24.6200),
                    ft_rate = COALESCE(ft_rate, 0.1623),
                    vat_percent = COALESCE(vat_percent, 7.00)
                WHERE tier1_rate IS NULL OR service_charge IS NULL
            `);
        }
        BillingService.schemaEnsured = true;
    }

    async getBillingConfigs(queryParams: any) {
        await this.ensureSchema();
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query(`SELECT COUNT(*) FROM billing_config`);
        const total = parseInt(countResult.rows[0].count);
        const result = await query(`SELECT * FROM billing_config ORDER BY effective_date DESC, id DESC LIMIT $1 OFFSET $2`, [limit, offset]);
        return { data: result.rows, total, page, limit };
    }

    async createBillingConfig(data: any) {
        await this.ensureSchema();
        const result = await query(
            `INSERT INTO billing_config (
                effective_date, unit_price, rate_mode, tier1_limit,
                tier1_rate, tier2_rate, service_charge, ft_rate, vat_percent,
                is_active, created_by, created_on
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *`,
            [
                data.effectiveDate,
                data.unitPrice ?? 4.1500,
                data.rateMode ?? 'tiered',
                data.tier1Limit ?? 200.00,
                data.tier1Rate ?? 3.0000,
                data.tier2Rate ?? 4.2200,
                data.serviceCharge ?? 24.6200,
                data.ftRate ?? 0.1623,
                data.vatPercent ?? 7.00,
                data.isActive ?? true,
                data.createdBy,
            ]
        );
        return result.rows[0];
    }

    async updateBillingConfig(id: number, data: any) {
        await this.ensureSchema();
        const result = await query(
            `UPDATE billing_config SET
                effective_date = $1,
                unit_price = $2,
                rate_mode = $3,
                tier1_limit = $4,
                tier1_rate = $5,
                tier2_rate = $6,
                service_charge = $7,
                ft_rate = $8,
                vat_percent = $9,
                is_active = $10,
                last_modified_by = $11,
                last_modified_on = NOW()
            WHERE id = $12 RETURNING *`,
            [
                data.effectiveDate,
                data.unitPrice,
                data.rateMode ?? 'tiered',
                data.tier1Limit ?? 200.00,
                data.tier1Rate ?? 3.0000,
                data.tier2Rate ?? 4.2200,
                data.serviceCharge ?? 24.6200,
                data.ftRate ?? 0.1623,
                data.vatPercent ?? 7.00,
                data.isActive,
                data.modifiedBy,
                id,
            ]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Billing config not found');
        return result.rows[0];
    }

    async deleteBillingConfig(id: number) {
        await this.ensureSchema();
        const result = await query(`DELETE FROM billing_config WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Billing config not found');
        return result.rows[0];
    }
}

export class TouBillingService {
    private static schemaEnsured = false;

    private async ensureSchema() {
        if (TouBillingService.schemaEnsured) return;
        await query(`
            CREATE TABLE IF NOT EXISTS tou_tariff_config (
                id SERIAL PRIMARY KEY,
                effective_date DATE NOT NULL,
                on_peak_rate NUMERIC(10, 4) NOT NULL DEFAULT 5.7982,
                off_peak_rate NUMERIC(10, 4) NOT NULL DEFAULT 2.6369,
                demand_rate NUMERIC(10, 4) NOT NULL DEFAULT 210.0000,
                pf_penalty_rate NUMERIC(10, 4) NOT NULL DEFAULT 56.0700,
                pf_threshold_factor NUMERIC(10, 4) NOT NULL DEFAULT 0.6197,
                service_charge NUMERIC(10, 4) NOT NULL DEFAULT 38.2200,
                ft_rate NUMERIC(10, 4) NOT NULL DEFAULT 0.1623,
                vat_percent NUMERIC(5, 2) NOT NULL DEFAULT 7.00,
                is_active BOOLEAN DEFAULT true,
                created_by VARCHAR(100),
                created_on TIMESTAMPTZ DEFAULT NOW(),
                last_modified_by VARCHAR(100),
                last_modified_on TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Seed default record if empty
        const countRes = await query(`SELECT COUNT(*)::int AS count FROM tou_tariff_config`);
        if (countRes.rows[0]?.count === 0) {
            await query(`
                INSERT INTO tou_tariff_config (
                    effective_date, on_peak_rate, off_peak_rate, demand_rate,
                    pf_penalty_rate, pf_threshold_factor, service_charge, ft_rate,
                    vat_percent, is_active, created_by
                ) VALUES (
                    '2026-01-01', 5.7982, 2.6369, 210.0000,
                    56.0700, 0.6197, 38.2200, 0.1623,
                    7.00, true, 'system'
                )
            `);
        }
        TouBillingService.schemaEnsured = true;
    }

    async getTouConfigs(queryParams: any) {
        await this.ensureSchema();
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query(`SELECT COUNT(*) FROM tou_tariff_config`);
        const total = parseInt(countResult.rows[0].count);
        const result = await query(
            `SELECT * FROM tou_tariff_config ORDER BY effective_date DESC, id DESC LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return { data: result.rows, total, page, limit };
    }

    async getCurrentTouConfig(targetDate?: string) {
        await this.ensureSchema();
        const date = targetDate || new Date().toISOString().slice(0, 10);
        const result = await query(
            `SELECT * FROM tou_tariff_config
             WHERE is_active = true AND effective_date <= $1::date
             ORDER BY effective_date DESC, id DESC LIMIT 1`,
            [date]
        );
        if (result.rows.length === 0) {
            // fallback to latest active config
            const fallback = await query(`SELECT * FROM tou_tariff_config WHERE is_active = true ORDER BY id DESC LIMIT 1`);
            return fallback.rows[0] || null;
        }
        return result.rows[0];
    }

    async createTouConfig(data: any) {
        await this.ensureSchema();
        const result = await query(
            `INSERT INTO tou_tariff_config (
                effective_date, on_peak_rate, off_peak_rate, demand_rate,
                pf_penalty_rate, pf_threshold_factor, service_charge, ft_rate,
                vat_percent, is_active, created_by, created_on
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            RETURNING *`,
            [
                data.effectiveDate,
                data.onPeakRate ?? 5.7982,
                data.offPeakRate ?? 2.6369,
                data.demandRate ?? 210.0000,
                data.pfPenaltyRate ?? 56.0700,
                data.pfThresholdFactor ?? 0.6197,
                data.serviceCharge ?? 38.2200,
                data.ftRate ?? 0.1623,
                data.vatPercent ?? 7.00,
                data.isActive ?? true,
                data.createdBy,
            ]
        );
        return result.rows[0];
    }

    async updateTouConfig(id: number, data: any) {
        await this.ensureSchema();
        const result = await query(
            `UPDATE tou_tariff_config SET
                effective_date = $1,
                on_peak_rate = $2,
                off_peak_rate = $3,
                demand_rate = $4,
                pf_penalty_rate = $5,
                pf_threshold_factor = $6,
                service_charge = $7,
                ft_rate = $8,
                vat_percent = $9,
                is_active = $10,
                last_modified_by = $11,
                last_modified_on = NOW()
            WHERE id = $12
            RETURNING *`,
            [
                data.effectiveDate,
                data.onPeakRate,
                data.offPeakRate,
                data.demandRate,
                data.pfPenaltyRate,
                data.pfThresholdFactor,
                data.serviceCharge,
                data.ftRate,
                data.vatPercent,
                data.isActive,
                data.modifiedBy,
                id,
            ]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'TOU tariff config not found');
        return result.rows[0];
    }

    async deleteTouConfig(id: number) {
        await this.ensureSchema();
        const result = await query(`DELETE FROM tou_tariff_config WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'TOU tariff config not found');
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

