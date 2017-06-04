# weapp-SignalR
SignalR Client for Weapp
## How to use
### 1. build with gulp
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

### 3. connection lifetime event
    started,
    received,
    connectionSlow,
    reconnecting,
    reconnected,
    disconnectd


