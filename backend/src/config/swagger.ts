export const swaggerDocument = {
    openapi: '3.0.3',
    info: {
        title: 'EnergyPlus Monitoring API',
        version: '1.0.0',
        description: 'Comprehensive REST API documentation for EnergyPlus - Energy Monitoring & Management System',
        contact: {
            name: 'EnergyPlus Support',
        },
    },
    servers: [
        {
            url: '/api/v1',
            description: 'API v1 Base URL',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter your JWT token obtained from /auth/login',
            },
        },
    },
    security: [
        {
            bearerAuth: [],
        },
    ],
    paths: {
        '/auth/login': {
            post: {
                tags: ['Authentication'],
                summary: 'User login',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['username', 'password'],
                                properties: {
                                    username: { type: 'string', example: 'admin' },
                                    password: { type: 'string', example: 'admin123' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Login successful with JWT token' },
                    401: { description: 'Invalid credentials' },
                },
            },
        },
        '/auth/me': {
            get: {
                tags: ['Authentication'],
                summary: 'Get current logged-in user profile & permissions',
                responses: {
                    200: { description: 'Current user data' },
                    401: { description: 'Unauthorized' },
                },
            },
        },
        '/dashboard/zone': {
            get: {
                tags: ['Dashboards'],
                summary: 'Get Zone / Branch dashboard data & meter tree hierarchy',
                parameters: [
                    { name: 'siteId', in: 'query', schema: { type: 'integer' } },
                    { name: 'buildingId', in: 'query', schema: { type: 'integer' } },
                    { name: 'floor', in: 'query', schema: { type: 'string' } },
                    { name: 'zoneId', in: 'query', schema: { type: 'integer' } },
                    { name: 'mdb', in: 'query', schema: { type: 'string', enum: ['exclude', 'only'] }, description: 'Exclude or only MDB meters' },
                ],
                responses: {
                    200: { description: 'Dashboard metrics, tree, and trends' },
                },
            },
        },
        '/redis/latest': {
            get: {
                tags: ['Redis Realtime'],
                summary: 'Get latest realtime meter telemetry from Redis / DB',
                parameters: [
                    { name: 'siteId', in: 'query', schema: { type: 'integer' } },
                    { name: 'buildingId', in: 'query', schema: { type: 'integer' } },
                ],
                responses: {
                    200: { description: 'Latest telemetry records for all meters' },
                },
            },
        },
        '/redis/channels': {
            get: {
                tags: ['Redis Realtime'],
                summary: 'List active subscribed Redis channels',
                responses: {
                    200: { description: 'List of channel names (e.g. 1000_1)' },
                },
            },
        },
        '/redis/publish': {
            post: {
                tags: ['Redis Realtime'],
                summary: 'Publish telemetry message to a Redis channel (Admin only)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['channel', 'message'],
                                properties: {
                                    channel: { type: 'string', example: '1000_1' },
                                    message: { type: 'object' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Message published' },
                },
            },
        },
        '/redis/subscribe/{channel}': {
            get: {
                tags: ['Redis Realtime'],
                summary: 'SSE Real-time Stream subscription for a specific channel',
                parameters: [
                    { name: 'channel', in: 'path', required: true, schema: { type: 'string' }, example: '1000_1' },
                ],
                responses: {
                    200: { description: 'Server-Sent Events (SSE) live data stream' },
                },
            },
        },
        '/meters': {
            get: {
                tags: ['Meters'],
                summary: 'Get list of meters with pagination and search filters',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                    { name: 'search', in: 'query', schema: { type: 'string' } },
                    { name: 'siteId', in: 'query', schema: { type: 'integer' } },
                    { name: 'buildingId', in: 'query', schema: { type: 'integer' } },
                ],
                responses: {
                    200: { description: 'List of meters' },
                },
            },
            post: {
                tags: ['Meters'],
                summary: 'Create a new meter',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['meter_code', 'meter_name', 'site_id'],
                                properties: {
                                    meter_code: { type: 'string' },
                                    meter_name: { type: 'string' },
                                    address: { type: 'string' },
                                    site_id: { type: 'integer' },
                                    building_id: { type: 'integer' },
                                    zone_id: { type: 'integer' },
                                    meter_type_id: { type: 'integer' },
                                    meter_brand_id: { type: 'integer' },
                                    phase: { type: 'string' },
                                    floor: { type: 'string' },
                                    converter: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Meter created' },
                },
            },
        },
        '/meters/import': {
            post: {
                tags: ['Meters'],
                summary: 'Bulk import meters and auto-create Master Data (Sites, Buildings, Zones, Models)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['meters'],
                                properties: {
                                    meters: {
                                        type: 'array',
                                        items: { type: 'object' },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Bulk import summary report' },
                },
            },
        },
        '/meters/types': {
            get: {
                tags: ['Master Data'],
                summary: 'Get all meter types (ELE, WAT, GAS, MDB, SOL, Humidity, Temperature)',
                responses: { 200: { description: 'List of meter types' } },
            },
        },
        '/meters/brands': {
            get: {
                tags: ['Master Data'],
                summary: 'Get all meter models & brands',
                responses: { 200: { description: 'List of meter models' } },
            },
            post: {
                tags: ['Master Data'],
                summary: 'Create a new meter model/brand',
                responses: { 201: { description: 'Model created' } },
            },
        },
        '/sites': {
            get: {
                tags: ['Master Data'],
                summary: 'Get all sites with building & meter counts',
                responses: { 200: { description: 'List of sites' } },
            },
            post: {
                tags: ['Master Data'],
                summary: 'Create a new site',
                responses: { 201: { description: 'Site created' } },
            },
        },
        '/sites/buildings': {
            get: {
                tags: ['Master Data'],
                summary: 'Get all buildings',
                parameters: [{ name: 'siteId', in: 'query', schema: { type: 'integer' } }],
                responses: { 200: { description: 'List of buildings' } },
            },
        },
        '/sites/zones': {
            get: {
                tags: ['Master Data'],
                summary: 'Get all zones',
                parameters: [{ name: 'buildingId', in: 'query', schema: { type: 'integer' } }],
                responses: { 200: { description: 'List of zones' } },
            },
        },
        '/alarms': {
            get: {
                tags: ['Alarms & Alerts'],
                summary: 'Get alarm threshold configurations',
                responses: { 200: { description: 'List of alarm configs' } },
            },
        },
        '/alarms/logs': {
            get: {
                tags: ['Alarms & Alerts'],
                summary: 'Get historical alarm trigger logs',
                responses: { 200: { description: 'List of alarm logs' } },
            },
        },
        '/reports/summary': {
            get: {
                tags: ['Reports'],
                summary: 'Get energy consumption summary report (by site/building/date range)',
                responses: { 200: { description: 'Report dataset' } },
            },
        },
        '/billing/tariffs': {
            get: {
                tags: ['Billing & Tariffs'],
                summary: 'Get electricity billing TOU tariff rates and config',
                responses: { 200: { description: 'Tariff settings' } },
            },
        },
        '/license/status': {
            get: {
                tags: ['System License'],
                summary: 'Get current system license status, quotas, and expiration',
                responses: { 200: { description: 'License validation status' } },
            },
        },
        '/license/activate': {
            post: {
                tags: ['System License'],
                summary: 'Activate or update system license key (Admin only)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['licenseKey'],
                                properties: {
                                    licenseKey: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: { 200: { description: 'License activated successfully' } },
            },
        },
        '/exports': {
            get: {
                tags: ['Automated Exports'],
                summary: 'Get list of automated scheduled export configs',
                responses: { 200: { description: 'List of export configs' } },
            },
        },
    },
};
