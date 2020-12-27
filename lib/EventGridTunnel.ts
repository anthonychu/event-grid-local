import { QueueServiceClient } from "@azure/storage-queue";
import got from 'got';
import { Config, ConfigEventSubscription, readConfig } from "./utils";

class EventGridTunnel {
    private events: SubscriptionEvent[] = [];
    private config: Config | undefined;

    async start() {
        this.config = readConfig();
    
        const storageConnectionString = this.config.storage.connectionString;
        const queueServiceClient = QueueServiceClient.fromConnectionString(storageConnectionString);
        const listenerPromises: Promise<void>[] = [];
    
        for (const [name, eventSubscription] of Object.entries(this.config.eventSubscriptions)) {
            listenerPromises.push(this.listenToSubscription(queueServiceClient, eventSubscription));
        }
    
        await Promise.all(listenerPromises);
    }
    
    private async listenToSubscription(queueServiceClient: QueueServiceClient, eventSubscription: ConfigEventSubscription) {
        const queueName = eventSubscription.queueName;
        const queueClient = queueServiceClient.getQueueClient(queueName);
    
        const minimumBackoffMilliseconds = 1000;
        const maximumBackoffMilliseconds = 20000;
        let backoffMilliseconds = minimumBackoffMilliseconds;
    
        while (true) {
            const { receivedMessageItems: messages } = await queueClient.receiveMessages({
                numberOfMessages: 16
            });
    
            for (const msg of messages) {
                const text = Buffer.from(msg.messageText, "base64").toString("utf-8");
                console.log(text);
                const subscriptionEvent: SubscriptionEvent = {
                    eventSubscriptionName: eventSubscription.eventSubscriptionName,
                    body: text,
                    headers: {
                        'Content-type': 'application/json',
                        "aeg-event-type": "Notification"
                    },
                    url: `http://localhost:7071/runtime/webhooks/EventGrid?functionName=${eventSubscription.functionName}`
                };

                try {
                    const response = await got.post(subscriptionEvent.url, {
                        body: subscriptionEvent.body,
                        headers: subscriptionEvent.headers
                    });
                    console.log(response.statusCode);
                    subscriptionEvent.webhookResponse = {
                        statusCode: response.statusCode,
                        message: response.statusMessage
                    };
                } catch (error) {
                    console.log(error);
                }
                await queueClient.deleteMessage(msg.messageId, msg.popReceipt);
                this.events.push(subscriptionEvent)
            }
    
            if (messages.length) {
                backoffMilliseconds = minimumBackoffMilliseconds;
            } else {
                backoffMilliseconds = Math.min(backoffMilliseconds + 1000, maximumBackoffMilliseconds);
            }
            console.log(`${queueName} waiting ${backoffMilliseconds}ms...`)
    
            await (new Promise(resolve => setTimeout(resolve, backoffMilliseconds)));
        }
    }
}

interface SubscriptionEvent {
    eventSubscriptionName: string;
    url: string;
    headers: { [key: string]: string };
    body: string;
    webhookResponse?: {
        statusCode: number,
        message?: string
    };
}

export default EventGridTunnel;