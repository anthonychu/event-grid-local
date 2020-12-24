import start from "./lib/start";
import createSubscriptions from "./lib/createSubscriptions";

if (process.argv.length > 2 && process.argv[2] === "subscribe") {
    createSubscriptions();
} else {
    start();
}
