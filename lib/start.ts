import { QueueServiceClient } from "@azure/storage-queue";
import got from 'got';
import { readConfig } from "./utils";

async function start() {
    const config = readConfig();

    const storageConnectionString = config.storage.connectionString;
    const queueServiceClient = QueueServiceClient.fromConnectionString(storageConnectionString);
    const queueClient = queueServiceClient.getQueueClient("test");

    const minimumBackoffMilliseconds = 2000;
    const maximumBackoffMilliseconds = 20000;
    let backoffMilliseconds = minimumBackoffMilliseconds;
    while (true) {
        const { receivedMessageItems: messages } = await queueClient.receiveMessages({
            numberOfMessages: 32
        });

        for (const msg of messages) {
            const text = Buffer.from(msg.messageText, "base64").toString("utf-8");
            console.log(text);
            try {
                const response = await got.post('http://localhost:7071/runtime/webhooks/EventGrid?functionName=test', {
                    body: `${text}`,
                    headers: {
                        'Content-type': 'application/json',
                        "aeg-event-type": "Notification"
                    }
                });
                console.log(response.statusCode);
            } catch (error) {
                console.log(error);
            }
            await queueClient.deleteMessage(msg.messageId, msg.popReceipt);
        }

        if (messages.length) {
            backoffMilliseconds = minimumBackoffMilliseconds;
        } else {
            backoffMilliseconds = Math.min(Math.floor(backoffMilliseconds * 1.5), maximumBackoffMilliseconds);
        }
        console.log(`waiting ${backoffMilliseconds}ms...`)

        await (new Promise(resolve => setTimeout(resolve, backoffMilliseconds)));
    }
}

export default start;