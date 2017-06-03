var signalr = require('../build/browser/signalr-client.js');

var d = new signalr.Connection("https://swiftsignalrtest.azurewebsites.net/echo");
d.started(()=>{
    console.log("connected");
})
d.start();


