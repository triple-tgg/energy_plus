import { aggregationConfig } from '../../config/aggregation';
import { aggregationService } from './aggregation.service';

interface SimpleSchedule {
    minute: number | '*' | { every: number };
    hour: number | '*';
    dayOfMonth: number | '*';
}

const parseSchedule = (expression: string): SimpleSchedule => {
    const [minute = '*', hour = '*', dayOfMonth = '*'] = expression.trim().split(/\s+/);
    const parseMinutePart = (value: string): number | '*' | { every: number } => {
        if (value === '*') {
            return '*';
        }
        if (value.startsWith('*/')) {
            const parsedEvery = Number(value.slice(2));
            return Number.isInteger(parsedEvery) && parsedEvery > 0 ? { every: parsedEvery } : '*';
        }
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : '*';
    };

    const parsePart = (value: string): number | '*' => {
        if (value === '*') {
            return '*';
        }
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : '*';
    };

    return {
        minute: parseMinutePart(minute),
        hour: parsePart(hour),
        dayOfMonth: parsePart(dayOfMonth),
    };
};

const getZonedParts = (date: Date, timeZone: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
        hour: Number(values.hour),
        minute: Number(values.minute),
    };
};

const matchesSchedule = (schedule: SimpleSchedule, date: Date): boolean => {
    const parts = getZonedParts(date, aggregationConfig.timezone);
    const minuteMatches = schedule.minute === '*'
        || (typeof schedule.minute === 'number' && schedule.minute === parts.minute)
        || (typeof schedule.minute === 'object' && parts.minute % schedule.minute.every === 0);

    return minuteMatches
        && (schedule.hour === '*' || schedule.hour === parts.hour)
        && (schedule.dayOfMonth === '*' || schedule.dayOfMonth === parts.day);
};

const scheduleKey = (name: string, date: Date): string => {
    const parts = getZonedParts(date, aggregationConfig.timezone);
    return `${name}:${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}`;
};

export class AggregationScheduler {
    private timer?: NodeJS.Timeout;
    private running = false;
    private lastRunKeys = new Set<string>();
    private minuteSchedule = parseSchedule(aggregationConfig.minuteCron);
    private dailySchedule = parseSchedule(aggregationConfig.dailyCron);
    private monthlySchedule = parseSchedule(aggregationConfig.monthlyCron);
    private retentionSchedule = parseSchedule(aggregationConfig.retentionCron);

    async start(): Promise<void> {
        if (!aggregationConfig.enabled) {
            console.log('⏸️  Aggregation jobs are disabled (AGGREGATION_ENABLED=false)');
            return;
        }

        await aggregationService.ensureSchema();
        await this.tick();
        this.timer = setInterval(() => {
            this.tick().catch((error) => {
                console.error('❌ Aggregation scheduler tick failed:', error.message);
            });
        }, 60 * 1000);

        console.log('📊 Aggregation jobs started');
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    private async tick(): Promise<void> {
        if (this.running) {
            return;
        }

        this.running = true;
        const now = new Date();
        try {
            await this.runIfDue('minute', this.minuteSchedule, now, () => aggregationService.aggregateRecentMinutes(now));
            await this.runIfDue('daily', this.dailySchedule, now, () => aggregationService.aggregatePreviousDay());
            await this.runIfDue('monthly', this.monthlySchedule, now, () => aggregationService.aggregateCurrentMonth());
            await this.runIfDue('retention', this.retentionSchedule, now, () => aggregationService.cleanupRealtimeData());
        } finally {
            this.running = false;
        }
    }

    private async runIfDue(name: string, schedule: SimpleSchedule, now: Date, callback: () => Promise<void>): Promise<void> {
        if (!matchesSchedule(schedule, now)) {
            return;
        }

        const key = scheduleKey(name, now);
        if (this.lastRunKeys.has(key)) {
            return;
        }

        this.lastRunKeys.add(key);
        if (this.lastRunKeys.size > 1000) {
            this.lastRunKeys.clear();
            this.lastRunKeys.add(key);
        }

        await callback();
    }
}

export const aggregationScheduler = new AggregationScheduler();
