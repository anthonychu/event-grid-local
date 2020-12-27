import { EventSubscriptionFilter } from '@azure/arm-eventgrid/esm/models';
import crypto from 'crypto';
import fs from 'fs';
import yaml from 'js-yaml';
import { machineIdSync } from 'node-machine-id';

export function readConfig(filename: string = "event-grid-tunnel.yml"): Config {
    const config = yaml.safeLoad(fs.readFileSync(filename, "utf8")) as Config;

    for (const [name, eventSubscription] of Object.entries(config.eventSubscriptions)) {
        if (!eventSubscription.topic) {
            throw new Error(`Event subscription ${name} is missing a topic`);
        }

        const uniqueEventSubscriptionName = generateEventSubscriptionName(name);
        eventSubscription.queueName = eventSubscription.queueName ?? uniqueEventSubscriptionName;
        eventSubscription.eventSubscriptionName = eventSubscription.eventSubscriptionName ?? uniqueEventSubscriptionName;
    }

    config.subscriptionId = getSubscriptionIdFromConfig(config);
    config.storage = {
        connectionString: getStorageConnectionString()
    };
    
    return config;
}

function getStorageConnectionString(): string {
    const storageConnectionString = process.env.EVENT_GRID_TUNNEL_STORAGE_CONNECTION;
    if (!storageConnectionString) {
        throw new Error("No storage connection string found in EVENT_GRID_TUNNEL_STORAGE_CONNECTION");
    }
    return storageConnectionString;
}

function generateEventSubscriptionName(eventSubscriptionName: string): string {
    const machineId = machineIdSync().substring(0, 8);
    const projectLocationHash = crypto.createHash("sha256").update(process.cwd(), "binary").digest('hex').substring(0, 8);
    const sanitizedEventSubscriptionName = eventSubscriptionName.toLowerCase().replace(/[^a-zA-Z0-9]/gi, "");
    return `eg-${machineId}-${projectLocationHash}-${sanitizedEventSubscriptionName}`;
}

function getSubscriptionIdFromConfig(config: Config): string {
    let subscriptionId;
    for (const [name, eventSubscription] of Object.entries(config.eventSubscriptions)) {
        if (eventSubscription.topic) {
            const currentSubId = getSubscriptionIdFromResourceId(eventSubscription.topic);
            if (!subscriptionId) {
                subscriptionId = currentSubId;
            } else if (subscriptionId !== currentSubId) {
                throw new Error(`Topics from more than one subscription id found in configuration`);
            }
        } else {
            throw new Error(`Event subscription ${name} missing topic`);
        }
    }

    if (!subscriptionId) {
        throw new Error(`No topics found in configuration`);
    }

    return subscriptionId;
}

function getSubscriptionIdFromResourceId(resourceId: string) {
    const match = /\/subscriptions\/([^\/]+)/i.exec(resourceId);
    if (match) {
        return match[1];
    } else {
        throw new Error(`Cannot extract subscription id from ${resourceId}`);
    }
}

export interface Config {
    eventSubscriptions: { [name: string]: ConfigEventSubscription };
    subscriptionId: string;
    storage: ConfigStorage;
}

export interface ConfigEventSubscription {
    filter?: EventSubscriptionFilter;
    functionName?: string;
    topic: string;
    queueName: string;
    eventSubscriptionName: string;
    events: SubscriptionEvent[];
}

export interface SubscriptionEvent {
    eventSubscriptionName: string;
    url: string;
    headers: { [key: string]: string };
    payload: any;
    webhookResponse?: {
        statusCode: number,
        message?: string
    };
}

interface ConfigStorage {
    connectionString: string;
}