import { query } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export class CompanyService {
    async getCompanyInfo() {
        const result = await query(`SELECT * FROM company LIMIT 1`);
        return result.rows[0] || null;
    }
    async updateCompanyInfo(data: any) {
        const existing = await this.getCompanyInfo();
        if (existing) {
            const result = await query(
                `UPDATE company SET company_name=$1, address=$2, contact_name=$3, contact_phone=$4, domain=$5 WHERE company_id=$6 RETURNING *`,
                [data.companyName, data.address, data.contactName, data.contactPhone, data.domain, existing.company_id]
            );
            return result.rows[0];
        }
        const result = await query(
            `INSERT INTO company (company_name, address, contact_name, contact_phone, domain) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [data.companyName, data.address, data.contactName, data.contactPhone, data.domain]
        );
        return result.rows[0];
    }
}
