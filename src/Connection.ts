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

        this.connectionInfo = new ConnectionInfo(url,new Date().getTime(),new Date().getTime(),ConnectionState.disconnected,query);
    }


    start(transport:ITransport):Promise<void>{
        this.transport = transport;

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
            
            if (this.started){
                this.started();
            }
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

    stop():Promise<void>;
    stop(error?:Error,timeout?:number):Promise<void>{
        if(error){
            this.onError(error);
        }
        if(!timeout){
            timeout = Connection.defaultAbortTimeout;
        }

        return new Promise<void>((reslove,reject)=>{});
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

    lostConnection(){

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

    onMessageReceived(message:string){

        if(this.received){
            this.received(message);
        }
    }

    onConnectionSlow(){
        if(this.connectionSlow){
            this.connectionSlow();
        }
    }

    onStarted(){
        if(this.started){
            this.started();
        }
    }

    onClosed(){
        if(this.closed){
            this.closed();
        }
    }

    onReconnecting(){
        if(this.reconnecting){
            this.reconnecting();
        }
    }

    onReconnected(){
        if(this.reconnected){
            this.reconnected();
        }
    }

    onError(e:Error){
        if(this.error){
            this.error(e);
        }
    }

    onNeedReconnect(){
        this.transport.doReconnect();
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
                connection.stop().then(()=>{reslove(false)});
            }
            reslove(true);
        })
    }
}

