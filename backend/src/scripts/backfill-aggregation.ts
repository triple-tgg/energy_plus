import { aggregationService } from '../modules/aggregation/aggregation.service';
import pool from '../config/database';

const args = process.argv.slice(2);

const getArg = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const inline = args.find((arg) => arg.startsWith(prefix));
    if (inline) {
        return inline.slice(prefix.length);
    }
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
};

const usage = () => {
    console.log(`
Usage:
  ts-node src/scripts/backfill-aggregation.ts --job minute --from 2026-07-04T00:00:00Z --to 2026-07-04T01:00:00Z
  ts-node src/scripts/backfill-aggregation.ts --job daily --date 2026-07-04
  ts-node src/scripts/backfill-aggregation.ts --job monthly --month 2026-07
  ts-node src/scripts/backfill-aggregation.ts --job retention --months 3
`);
};

async function main() {
    const job = getArg('job');
    await aggregationService.ensureSchema();

    if (job === 'minute') {
        const from = getArg('from');
        const to = getArg('to');
        if (!from || !to) {
            usage();
            throw new Error('minute backfill requires --from and --to');
        }
        await aggregationService.aggregateMinuteRange(new Date(from), new Date(to));
        console.log(`✅ Minute aggregation backfilled from ${from} to ${to}`);
        return;
    }

    if (job === 'daily') {
        const date = getArg('date');
        if (!date) {
            usage();
            throw new Error('daily backfill requires --date YYYY-MM-DD');
        }
        await aggregationService.aggregateDaily(date);
        console.log(`✅ Daily aggregation backfilled for ${date}`);
        return;
    }

    if (job === 'monthly') {
        const month = getArg('month');
        if (!month) {
            usage();
            throw new Error('monthly backfill requires --month YYYY-MM');
        }
        await aggregationService.aggregateMonthly(month);
        console.log(`✅ Monthly aggregation backfilled for ${month}`);
        return;
    }

    if (job === 'retention') {
        const months = Number(getArg('months') || '3');
        await aggregationService.cleanupRealtimeData(months);
        console.log(`✅ Realtime retention cleanup completed with ${months} month retention`);
        return;
    }

    usage();
    throw new Error('unknown --job');
}

main()
    .catch((error) => {
        console.error('❌ Backfill failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });

