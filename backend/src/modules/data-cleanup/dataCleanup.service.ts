import { query } from '../../config/database';

export class DataCleanupService {
    /**
     * Get current realtime data stats
     */
    async getRealtimeStats() {
        const result = await query(`
            SELECT
                COUNT(*)::int AS total_rows,
                MIN(received_at) AS oldest_record,
                MAX(received_at) AS newest_record,
                pg_size_pretty(pg_total_relation_size('meter_data_realtime')) AS table_size,
                COUNT(*) FILTER (WHERE received_at < NOW() - INTERVAL '24 hours')::int AS rows_older_than_24h,
                COUNT(*) FILTER (WHERE received_at < NOW() - INTERVAL '7 days')::int AS rows_older_than_7d,
                COUNT(*) FILTER (WHERE received_at < NOW() - INTERVAL '30 days')::int AS rows_older_than_30d
            FROM meter_data_realtime
        `);
        return result.rows[0] || {
            total_rows: 0,
            oldest_record: null,
            newest_record: null,
            table_size: '0 bytes',
            rows_older_than_24h: 0,
            rows_older_than_7d: 0,
            rows_older_than_30d: 0,
        };
    }

    /**
     * Delete realtime data older than the specified number of hours
     */
    async purgeRealtimeData(retentionHours: number) {
        if (retentionHours < 1) {
            throw new Error('Retention must be at least 1 hour');
        }

        // Count first
        const countResult = await query(
            `SELECT COUNT(*)::int AS count FROM meter_data_realtime WHERE received_at < NOW() - ($1 || ' hours')::INTERVAL`,
            [retentionHours.toString()]
        );
        const rowsToDelete = countResult.rows[0]?.count || 0;

        if (rowsToDelete === 0) {
            return { deleted: 0, message: 'No data to delete' };
        }

        // Delete in batches to avoid locking
        let totalDeleted = 0;
        const batchSize = 10000;
        let batchDeleted = 0;

        do {
            const result = await query(
                `DELETE FROM meter_data_realtime WHERE id IN (
                    SELECT id FROM meter_data_realtime
                    WHERE received_at < NOW() - ($1 || ' hours')::INTERVAL
                    LIMIT $2
                )`,
                [retentionHours.toString(), batchSize]
            );
            batchDeleted = result.rowCount || 0;
            totalDeleted += batchDeleted;
        } while (batchDeleted >= batchSize);

        return {
            deleted: totalDeleted,
            retentionHours,
            message: `Deleted ${totalDeleted} records older than ${retentionHours} hours`,
        };
    }
}
