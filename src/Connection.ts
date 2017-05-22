import { KeepAliveData } from "./KeepAliveData"
import { ITransport } from "./ITransport"
import {Started,Closed,Reconnecting,Reconnected,Exception,Received,NeedReconnect,ConnectionSlow,Version,PROTOCOL_VERSION,ConnectionState,ConnectionInfo} from "./Common"
import {UrlBuilder} from "./UrlBuilder"



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
        let timeElapsed = Date.now() - this.connection.lastMessageAt.getTime();
        this.beat(timeElapsed);
    }

    private beat(timeElapsed:number){
        if(this.monitorKeepAlive){
            this.checkKeepAlive(timeElapsed);
        }

        this.connection.markActive();
    }

    private checkKeepAlive(timeElapsed:number){
        if(this.connection.connectionInfo.state == ConnectionState.connected){
            if(this.connection.keepAliveData && timeElapsed >= this.connection.keepAliveData.timeout){
                if(!this.timeout){
                    this.timeout = true;
                    this.connection.lostConnection();
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
    lastMessageAt: Date;
    connectionId: string;

    started?: Started;
    closed?: Closed;
    received?: Received;
    error?: Exception;
    reconnecting?: Reconnecting;
    reconnected?: Reconnected;
    connectionSlow?: ConnectionSlow;


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

        this.connectionInfo = new ConnectionInfo(url,new Date(),ConnectionState.disconnected,query);
        this.lastMessageAt = new Date();
    }


    start(transport:ITransport):Promise<void>{
        this.registerConnectionEvent(transport);
        this.transport = transport;

        if(!this.changeState(ConnectionState.disconnected,ConnectionState.connecting)){
            throw new Error("a connection is already starting");
        }

        this.connectionInfo.connectionData = this.onSending();

        return this.transport.negotiate(this.connectionInfo).then((res)=>{
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
            
            if (this.started){
                this.started();
            }
            this.connectionInfo.lastActive = new Date();

            this.lastMessageAt = new Date();
            
            this.heartBeatMonitor.start();
        }).catch(e=>{
            this.changeState(this.connectionInfo.state,ConnectionState.disconnected)
                throw e;
        })
    }

    startTransport():Promise<void>{
        return this.transport.start();
    }

    markActive(){

    }

    lostConnection(){

    }

    changeState(oldState:ConnectionState,newState:ConnectionState):boolean{
        if(this.connectionInfo.state == oldState){
            this.connectionInfo.state = newState;
            return true;
        }
        return false;
    }

    onSending():string{
        return '';
    }

    private verifyClientProtocol(protocol:string){
        var version = Version.parse(protocol);
        if(!this.connectionInfo.clientProtocol.isEqual(version)){
            throw new Error(`protocol version not match, client version:${this.connectionInfo.clientProtocol.toString()}, server version:${version.toString()}`);
        }
    }

    private registerConnectionEvent(transport: ITransport){
        transport.onStarted = this.onStarted;
        transport.onClosed = this.onClosed;
        transport.onReconnecting = this.onReconnecting;
        transport.onReconnected = this.onReconnected;
        transport.onError = this.onError;
        transport.onMessageReceived = this.onMessageReceived;
        transport.needReconnect = this.onNeedReconnect;
    }

    onConnectionSlow(){
        if(this.connectionSlow){
            this.connectionSlow();
        }
    }

    private onStarted(){
        if(this.started){
            this.started();
        }
    }

    private onClosed(){
        if(this.closed){
            this.closed();
        }
    }

    private onReconnecting(){
        if(this.reconnecting){
            this.reconnecting();
        }
    }

    private onReconnected(){
        if(this.reconnected){
            this.reconnected();
        }
    }

    private onError(e:Error){
        if(this.error){
            this.error(e);
        }
    }

    private onMessageReceived(message:string){
        if(this.received){
            this.received(message);
        }
    }

    private onNeedReconnect(){
        this.transport.doReconnect();
    }

    private createQuerystring(queryDic:Map<string,string>):string{
        var queryString = '';
        queryDic.forEach((val,key)=> queryString = queryString.concat(`${key}=${val}&`));
        return queryString.slice(0,-1);
    }

    private verfiyLastActive():boolean{
        return true;
    }
}

