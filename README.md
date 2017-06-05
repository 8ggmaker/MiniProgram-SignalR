# weapp-SignalR
SignalR Client for weapp and browser, only supports WebSocket now.
## How to use
### 1. build with gulp
    npm install
    gulp
### 2. quick start  
    var signalR = require('yourpath/signalr-client')
    var hubConnection = new signalR.HubConnection(url);
    var hubProxy = hubConnection.createHubProxy(hubName);
    hubProxy.on(eventName,function(...args){

    })
    hubConnection.started(()=>{
        hubProxy.invoke(methodname,...args).then(()=>{

        })
    })
    hubConnection.start()

### 3. connection lifetime event
    started
    received
    connectionSlow
    reconnecting
    reconnected
    disconnected


