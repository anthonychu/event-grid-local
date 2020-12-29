#!/usr/bin/env node

import EventGridTunnel from "./lib/EventGridTunnel";
import createSubscriptions from "./lib/createSubscriptions";
import { startServer } from "./lib/server";

if (process.argv.length > 2 && process.argv[2] === "subscribe") {
    createSubscriptions();
} else if (process.argv.length > 2 && process.argv[2] === "start") {
    const socketServer = startServer();
    const tunnel = new EventGridTunnel(socketServer);
    tunnel.start();
} else {
    console.log(`\nAzure Event Grid Local Debugger
    
    event-grid-local <command>
    
    command:
        help - this screen
        subscribe - configures queues and event subscriptions based on configuration
        start - starts the local debugger\n`);
}
