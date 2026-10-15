import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import {
    getChannelSample,
    getDiscoverySummary,
    linkChannelToMeter,
    listDiscoveredChannels,
    searchMetersForLink,
    setChannelIgnored,
    unlinkMeter,
} from './discovery.service';

const handle = (label: string, fn: (req: Request) => Promise<unknown>) =>
    async (req: Request, res: Response): Promise<void> => {
        try {
            res.json(successResponse(await fn(req)));
        } catch (error: any) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json(errorResponse(error.code, error.message));
                return;
            }
            console.error(`Redis discovery ${label} error:`, error);
            res.status(500).json(errorResponse('DISCOVERY_ERROR', error.message));
        }
    };

const requireString = (value: unknown, name: string): string => {
    const s = String(value ?? '').trim();
    if (!s) throw new AppError(400, 'VALIDATION_ERROR', `${name} is required`);
    return s;
};

const requireInt = (value: unknown, name: string): number => {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) throw new AppError(400, 'VALIDATION_ERROR', `${name} must be a positive integer`);
    return n;
};

/** GET /redis/discovery */
export const discoveryList = handle('list', () => listDiscoveredChannels());

/** GET /redis/discovery/summary */
export const discoverySummary = handle('summary', () => getDiscoverySummary());

/** GET /redis/discovery/sample?channel= */
export const discoverySample = handle('sample', (req) => getChannelSample(requireString(req.query.channel, 'channel')));

/** GET /redis/discovery/meters?q= */
export const discoveryMeters = handle('meters', (req) => searchMetersForLink(String(req.query.q ?? '')));

/** POST /redis/discovery/link { baseChannel, meterId } */
export const discoveryLink = handle('link', (req) =>
    linkChannelToMeter(requireString(req.body?.baseChannel, 'baseChannel'), requireInt(req.body?.meterId, 'meterId')));

/** POST /redis/discovery/unlink { meterId } */
export const discoveryUnlink = handle('unlink', (req) => unlinkMeter(requireInt(req.body?.meterId, 'meterId')));

/** POST /redis/discovery/ignore { baseChannel, ignored } */
export const discoveryIgnore = handle('ignore', (req) =>
    setChannelIgnored(
        requireString(req.body?.baseChannel, 'baseChannel'),
        req.body?.ignored !== false,
        (req as any).user?.userName ?? null,
    ));
