import {WebSocketTransport} from "./Transports"
import {Connection} from "./Connection"

let connection = new Connection("https://swiftsignalrtest.azurewebsites.net/echo");
connection.started = ()=>{
    console.log("started");
}

connection.start(new WebSocketTransport());