import { QueueServiceClient } from "@azure/storage-queue";
import got from 'got';
import { SocketInfo, SocketServer } from "./server";
import { Config, ConfigEventSubscription, readConfig, SubscriptionEvent } from "./utils";

class EventGridTunnel {
    private config: Config | undefined;

    constructor(private socketServer: SocketServer) {
        socketServer.registerCallback("connection", this.onConnected.bind(this));
    }

    private async onConnected(socketInfo: SocketInfo) {
        console.log(`${socketInfo.socket?.id}`);
        if (socketInfo.socket) {
            socketInfo.socket.emit("existingEvents", this.config);
        }
    }

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
    
        console.log(`Starting listener for queue ${queueName}`);

        if (!eventSubscription.events) {
            eventSubscription.events = [];
        }

        while (true) {
            const { receivedMessageItems: messages } = await queueClient.receiveMessages({
                numberOfMessages: 16
            });
    
            for (const msg of messages) {
                const text = Buffer.from(msg.messageText, "base64").toString("utf-8");
                console.log(text);
                const subscriptionEvent: SubscriptionEvent = {
                    eventSubscriptionName: eventSubscription.eventSubscriptionName,
                    payload: JSON.parse(text),
                    headers: {
                        'Content-type': 'application/json',
                        "aeg-event-type": "Notification"
                    },
                    url: `http://localhost:7071/runtime/webhooks/EventGrid?functionName=${eventSubscription.functionName}`
                };

                try {
                    const response = await got.post(subscriptionEvent.url, {
                        json: subscriptionEvent.payload,
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
                eventSubscription.events.push(subscriptionEvent)
            }
    
            if (messages.length) {
                backoffMilliseconds = minimumBackoffMilliseconds;
            } else {
                backoffMilliseconds = Math.min(backoffMilliseconds + 1000, maximumBackoffMilliseconds);
            }
            // console.log(`${queueName} waiting ${backoffMilliseconds}ms...`)
    
            await (new Promise(resolve => setTimeout(resolve, backoffMilliseconds)));
        }
    }
}

export default EventGridTunnel;