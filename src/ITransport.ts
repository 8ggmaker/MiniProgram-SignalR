import {Started,Closed,Reconnecting,Reconnected,Exception,Received,NeedReconnect,ConnectionInfo,NegotiateResponse} from "./Common"

export interface ITransport{
    onStarted?: Started;
    onClosed?: Closed;
    onReconnecting?: Reconnecting;
    onReconnected?: Reconnected;
    onError?: Exception;
    onMessageReceived?:Received;
    needReconnect?:NeedReconnect;
    negotiate(connectionInfo:ConnectionInfo):Promise<NegotiateResponse>
    start():Promise<void>;
    send(data:string):void;
    getName():string;
    stop():void;
    supportKeepAlive:boolean;
    doReconnect():void;
}