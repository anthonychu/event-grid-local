#!/usr/bin/env node

import EventGridLocal from "./lib/EventGridLocal";
import createSubscriptions from "./lib/createSubscriptions";
import chalk from 'chalk';
import { startServer } from "./lib/server";
import path from "path";
import fs from "fs";

if (process.argv.length > 2 && process.argv[2] === "subscribe") {
    createSubscriptions();
} else if (process.argv.length > 2 && process.argv[2] === "start") {
    const socketServer = startServer();
    const eventGridLocal = new EventGridLocal(socketServer);
    eventGridLocal.start();
} else {
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    let packageJsonVersion: string | undefined;
    if (fs.existsSync(packageJsonPath)) {
        const packageJson: { version?: string } | undefined
            = require(packageJsonPath);
        packageJsonVersion = packageJson?.version;
    }

    console.log(`\nAzure Event Grid Local Debugger ${packageJsonVersion ? `(version ${packageJsonVersion})` : ""}
    
    event-grid-local <command>
    
    command:
        help
            - this screen
        subscribe 
            - configures queues and event subscriptions based on configuration
              (requires Azure CLI to be installed and logged in)
        start
            - starts the local debugger\n`);
}

function handleError(err: Error) {
    console.error(chalk.red(err.message));
    if (err.name !== "AppError" && err.stack) {
        console.error(chalk.red(err.stack));
    }
    process.exit(1);
}

process.on("uncaughtException", handleError);
process.on("unhandledRejection", handleError);