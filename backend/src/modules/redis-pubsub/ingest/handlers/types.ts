import { PoolClient } from 'pg';
import { ParsedHeader } from '../messageParser';

/**
 * One handler per datatype family. To support a new datatype:
 *   1. create `<name>.handler.ts` implementing DatatypeHandler
 *   2. register it in `handlers/index.ts`
 * Subscription, parsing and routing need no change.
 */
export interface DatatypeHandler {
    /** Handler name for logs. */
    name: string;
    /** Upper-case datatype values this handler accepts. */
    datatypes: string[];
    /** Persist one message. Runs inside a transaction owned by the router. */
    save(client: PoolClient, header: ParsedHeader, data: Record<string, any>): Promise<void>;
}
