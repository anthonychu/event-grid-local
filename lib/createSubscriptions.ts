import { QueueItem, QueueServiceClient } from "@azure/storage-queue";
import { EventGridManagementClient } from "@azure/arm-eventgrid";
import { AzureCliCredentials } from "@azure/ms-rest-nodeauth";
import { StorageManagementClient } from "@azure/arm-storage";
import { machineIdSync } from 'node-machine-id';
import { Config, readConfig } from "./utils";

async function createSubscriptions() {
    const config = readConfig();
    const subscriptionId = config.subscriptionId;
    const storageConnectionString = config.storage.connectionString;

    const queueServiceClient = QueueServiceClient.fromConnectionString(storageConnectionString);
    const storageAccountName = queueServiceClient.accountName;

    const creds = await AzureCliCredentials.create({ subscriptionIdOrName: subscriptionId });
    console.log(">>> Subscription associated with the access token: '%s'.",
        creds.tokenInfo.subscription);

    const storageArmClient = new StorageManagementClient(creds, subscriptionId);
    const allStorageAccounts = await storageArmClient.storageAccounts.list();
    const storageAccount = allStorageAccounts.find(a => a.name === storageAccountName);

    if (!storageAccount) {
        throw new Error(`Storage account ${storageAccountName} not found in subscription ${subscriptionId}`);
    }

    const client = new EventGridManagementClient(creds, subscriptionId);

    const existingQueues: QueueItem[] = [];
    for await (const item of queueServiceClient.listQueues()) {
        existingQueues.push(item);
    }

    for (const [name, eventSubscription] of Object.entries(config.eventSubscriptions)) {
        const queueExists = existingQueues.some(q => q.name === eventSubscription.queueName);
        if (!queueExists) {
            console.log(`Creating queue ${eventSubscription.queueName}`);
            await queueServiceClient.createQueue(eventSubscription.queueName);
        }

        console.log(`Creating or updating subscription ${eventSubscription.queueName}. Topic: ${eventSubscription.topic}...`)
        const result = await client.eventSubscriptions.createOrUpdate(
            eventSubscription.topic,
            eventSubscription.eventSubscriptionName,
            {
                destination: {
                    endpointType: "StorageQueue",
                    queueName: eventSubscription.queueName,
                    resourceId: storageAccount.id
                },
                filter: eventSubscription.filter
            }
        )
        console.log(result);
    }
}

export default createSubscriptions;