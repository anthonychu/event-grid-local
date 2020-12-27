import EventGridTunnel from "./lib/EventGridTunnel";
import createSubscriptions from "./lib/createSubscriptions";

if (process.argv.length > 2 && process.argv[2] === "subscribe") {
    createSubscriptions();
} else {
    const tunnel = new EventGridTunnel();
    tunnel.start();
}
