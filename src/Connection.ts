import { KeepAliveData } from "./KeepAliveData"
import { ITransport } from "./ITransport"
import {Utils,Started,Closed,Reconnecting,Reconnected,Exception,Received,ConnectionSlow,Version,PROTOCOL_VERSION,ConnectionState,ConnectionInfo} from "./Common"
import {UrlBuilder} from "./UrlBuilder"
import {Subscriber,EventBus} from "./Subscribe"
import {WebSocketTransport} from "./Transports";


export class ConnectingMessageBuffer{
    buffer: any[];
    connection:Connection;
    drainCallback:(message:any)=>void;

    constructor(connection:Connection,drainCallback:(message:any)=>void){
        this.buffer = [];
        this.connection = connection;
        this.drainCallback = drainCallback;
    }

    tryBuffer(message:any):boolean{
        if(this.connection.connectionInfo.state === ConnectionState.connecting){
            this.buffer.push(message);
            return true;
        }

        return false;
    }

    drain(){
        if(this.connection.connectionInfo.state === ConnectionState.connected){
            while(this.buffer.length>0){
                this.drainCallback(this.buffer.shift());
            }
        }
    }

    clear(){
        this.buffer = [];
    }

}
export class HeartBeatMonitor{
    private connection: Connection;
    private beatInterval: number;
    private beatHandlerInterval:number;
    private monitorKeepAlive: boolean = false;
    private hasBeenWarned: boolean = false;
    private timeout: boolean = false;

    constructor(connection:Connection,beatInterval:number){
        this.connection = connection;
        this.beatInterval = beatInterval;
    }

    start(){
        this.monitorKeepAlive = this.connection.keepAliveData && this.connection.transport.supportKeepAlive;
        this.clearFlags();
        this.beatHandlerInterval = setInterval(()=>this.heartBeat(),this.beatInterval * 1000);

    }

    reconnected(){
        this.clearFlags();
    }

    stop(){
        clearInterval(this.beatHandlerInterval);
    }
    private heartBeat(){
        let timeElapsed = Date.now() - this.connection.connectionInfo.lastMessageAt;
        this.beat(timeElapsed);
    }

    private beat(timeElapsed:number){
        if(this.monitorKeepAlive){
            this.checkKeepAlive(timeElapsed);
        }

        this.connection.markActive();
    }

    private checkKeepAlive(timeElapsed:number){
        if(this.connection.connectionInfo.state === ConnectionState.connected){
            if(this.connection.keepAliveData && timeElapsed >= this.connection.keepAliveData.timeout){
                if(!this.timeout){
                    this.timeout = true;
                    this.connection.transport.lostConnection();
                }
            }else if(this.connection.keepAliveData && timeElapsed >= this.connection.keepAliveData.timeoutWarning){
                if(!this.hasBeenWarned){
                    this.hasBeenWarned = true;
                    this.connection.onConnectionSlow();
                }
            }else{
                this.clearFlags();
            }
        }
    }

    private clearFlags(){
        this.timeout = false;
        this.hasBeenWarned = false;
    }
}

export class Connection{
    static readonly defaultAbortTimeout: number = 30;
    private heartBeatMonitor: HeartBeatMonitor

    connectionInfo:ConnectionInfo;
    transport: ITransport
    keepAliveData: KeepAliveData;
    connectionId: string;
    eventBus:EventBus;
    connectingMessageBuffer:ConnectingMessageBuffer;

    constructor(url:string,queryString?:Map<string,string>){
        if(!url){
            throw new Error("url is null or empty");
        }

        if(!url.endsWith('/')){
            url = url.concat('/');
        }

        var query = ''
        if(queryString){
            query = this.createQuerystring(queryString);
        }
        
        this.eventBus = new EventBus();
        this.connectionInfo = new ConnectionInfo(url,new Date().getTime(),new Date().getTime(),ConnectionState.disconnected,query);
        this.connectingMessageBuffer = new ConnectingMessageBuffer(this,message=>{this.onMessageReceived(message);})
    }

    start(transport?:ITransport):Promise<void>{
        this.transport = transport || new WebSocketTransport();

        if(!this.changeState(ConnectionState.disconnected,ConnectionState.connecting)){
            throw new Error("a connection is already starting");
        }

        this.connectionInfo.connectionData = this.onSending();

        return this.transport.negotiate(this).then((res)=>{
            this.verifyClientProtocol(res.ProtocolVersion);
            this.connectionInfo.connectionToken = res.ConnectionToken;
            this.connectionId = res.ConnectionId;
            this.connectionInfo.disconnectTimeout = res.DisconnectTimeout;
            this.connectionInfo.transportConnectTimeout = res.TransportConnectTimeout;

            var beatInterval = 5;
            if(res.KeepAliveTimeout){
                this.keepAliveData = new KeepAliveData(res.KeepAliveTimeout);
                this.connectionInfo.reconnectWindow = this.connectionInfo.disconnectTimeout + this.keepAliveData.timeout;

                beatInterval = this.keepAliveData.checkInterval;
            }else{
                this.connectionInfo.reconnectWindow = this.connectionInfo.disconnectTimeout;
            }

            this.heartBeatMonitor = new HeartBeatMonitor(this,beatInterval);

            return this.startTransport();

        }).then(()=>{
            this.changeState(this.connectionInfo.state,ConnectionState.connected);
            
            this.connectingMessageBuffer.drain();
            
            this.onStarted();

            this.connectionInfo.lastActive = new Date().getTime();

            this.connectionInfo.lastMessageAt = new Date().getTime();
            
            this.heartBeatMonitor.start();
        }).catch(e=>{
            this.changeState(this.connectionInfo.state,ConnectionState.disconnected)
                throw e;
        })
    }

    startTransport():Promise<void>{
        return this.transport.start();
    }

    send(data:any):Promise<any>{
        return new Promise((resolve,reject)=>{
            if(this.connectionInfo.state === ConnectionState.disconnected){
                reject(new Error("connection is disconnectd, cannot send data"));
                return;
            }

            if(this.connectionInfo.state === ConnectionState.connecting){
                reject(new Error("connection is connecting, cannot send data"));
                return;
            }

            return this.transport.send(data);
        });
    }

    stop():Promise<void>;
    stop(error:Error):Promise<void>;
    stop(error?:Error,timeout?:number):Promise<void>{
        if(error){
            this.onError(error);
        }
        return new Promise<void>((reslove,reject)=>{
            if(this.connectionInfo.state == ConnectionState.disconnected){
                reslove();
            }
            let abortTimeout = timeout || Connection.defaultAbortTimeout
            let abortPromise = this.transport.abort(abortTimeout);

            this.disconnect();

            reslove();
        });
    }

    disconnect(){
        if(this.connectionInfo.state != ConnectionState.disconnected){
            this.connectionInfo.state = ConnectionState.disconnected;

            if(this.heartBeatMonitor){
                this.heartBeatMonitor.stop();
                this.heartBeatMonitor = null;
            }

            this.transport = null;
            this.connectionId = null;
            this.connectionInfo.clear();
            this.connectingMessageBuffer.clear();
            this.onDisconnected();
        }
    }
    markActive(){
        TransportHelper.verifyLastActive(this).then(res=>{
            if(res){
                this.connectionInfo.lastActive = new Date().getTime();
            }
        })
    }

    markLastMessage(){
        this.connectionInfo.lastMessageAt = new Date().getTime();
    }

    changeState(oldState:ConnectionState,newState:ConnectionState):boolean{
        if(this.connectionInfo.state === oldState){
            this.connectionInfo.state = newState;
            return true;
        }
        return false;
    }

    ensureReconnecting():boolean{
        if(this.changeState(ConnectionState.connected,ConnectionState.reconnecting)===true){
            this.onReconnecting();
        }
        return this.connectionInfo.state === ConnectionState.reconnecting;
    }

    onSending():string{
        return '';
    }

    onMessageReceived(message:any){

        this.eventBus.publish(Utils.events.onReceived,message);
    }

    onReconnecting(){
        this.eventBus.publish(Utils.events.onReconnecting);
    }

    onReconnected(){
        this.eventBus.publish(Utils.events.onReconnected);
    }

    onConnectionSlow(){
        this.eventBus.publish(Utils.events.onConnectionSlow);
    }

    onError(error:Error){
        this.eventBus.publish(Utils.events.onError,error);
    }

    onStarted(){
        this.eventBus.publish(Utils.events.onStart);
    }

    onDisconnected(){
        this.eventBus.publish(Utils.events.onClose);
    }

    started(callBack:Started){
        if(callBack){
            let subscriber = new Subscriber(Utils.events.onStart,callBack);
            this.eventBus.subscribe(subscriber);
        }
    }

    received(callBack:Received){
        if(callBack){
            let subscriber = new Subscriber(Utils.events.onReceived,callBack)
            this.eventBus.subscribe(subscriber);
        }
    }

    connectionSlow(callBack:ConnectionSlow){
        if(callBack){
            let subscriber = new Subscriber(Utils.events.onConnectionSlow,callBack);
            this.eventBus.subscribe(subscriber);
        }
    }

    reconnecting(callBack:Reconnecting){
        if(callBack){
            let subscriber = new Subscriber(Utils.events.onReconnecting,callBack);
            this.eventBus.subscribe(subscriber);
        }
    }

    reconnected(callBack:Reconnected){
        if(callBack){
            let subscriber = new Subscriber(Utils.events.onReconnected,callBack);
            this.eventBus.subscribe(subscriber);
        }
    }

    disconnected(callBack:Closed){
        if(callBack){
            let subscriber = new Subscriber(Utils.events.onClose,callBack);
            this.eventBus.subscribe(subscriber);
        }
    }

    error(callBack:Exception){
        if(callBack){
            let subscriber = new Subscriber(Utils.events.onError,callBack);
            this.eventBus.subscribe(subscriber);
        }
    }

    private createQuerystring(queryDic:Map<string,string>):string{
        var queryString = '';
        queryDic.forEach((val,key)=> queryString = queryString.concat(`${key}=${val}&`));
        return queryString.slice(0,-1);
    }

    private verifyClientProtocol(protocol:string){
        var version = Version.parse(protocol);
        if(!this.connectionInfo.clientProtocol.isEqual(version)){
            throw new Error(`protocol version not match, client version:${this.connectionInfo.clientProtocol.toString()}, server version:${version.toString()}`);
        }
    }
}

export class TransportHelper{
    // because weapp do not support sync request call, so make everything promise
    static verifyLastActive(connection:Connection):Promise<boolean>{
        return new Promise((reslove,reject)=>{
            if(new Date().getTime() - connection.connectionInfo.lastActive >= connection.connectionInfo.reconnectWindow){
                connection.stop(new Error("lastactive timeout")).then(()=>{reslove(false)});
            }
            reslove(true);
        })
    }
}

