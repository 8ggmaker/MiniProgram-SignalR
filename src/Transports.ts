import {Started,Closed,Reconnecting,Reconnected,Exception,Received,NeedReconnect,NegotiateResponse,ConnectionInfo,ConnectionState} from "./Common"
import {UrlBuilder} from "./UrlBuilder"
import {ITransport} from "./ITransport"
import {IHttpClient,HttpClient} from "./Http/HttpClient"

class TransportAbortHandler{
    tryCompeleteAbort():boolean{
        return false;
    }
}

class HttpBasedTransport{
    initCallback?: ()=>void;

    httpClient: IHttpClient
    urlBuilder: UrlBuilder
    connectionInfo: ConnectionInfo;
    abortHandler:TransportAbortHandler;

    onStarted?: Started;
    onClosed?: Closed;
    onReconnecting?: Reconnecting;
    onReconnected?: Reconnected;
    onError?: Exception;
    onMessageReceived?:Received;
    needConnect?:NeedReconnect;

    getName():string{
        return '';
    }
    
    negotiate(connectionInfo:ConnectionInfo):Promise<NegotiateResponse>{
        this.connectionInfo = connectionInfo;
        this.httpClient = new HttpClient();
        this.urlBuilder = new UrlBuilder(connectionInfo);

        // return new Promise<NegotiateResponse>((reslove,reject)=>{
        //     let url = this.urlBuilder.buildNegotiateUrl(this.getName());
        //     this.httpClient.get("GET").then((res)=>{
        //         reslove(JSON.parse(res) as NegotiateResponse);
        //     }).catch((e)=>{throw e});
        // });
        let url = this.urlBuilder.buildNegotiateUrl(this.getName());
        return this.httpClient.get(url).then((res)=>{
            return JSON.parse(res) as NegotiateResponse}
            ).catch(
                (e)=>{throw e
                });
    }

    initReceived():Promise<void>{
        let url = this.urlBuilder.buildStartUrl(this.getName());
        return this.httpClient.get(url).then(()=>{return;}).catch((e)=>{throw e;});
    }

    processMessage(message:string){
        if(!message){
            return;
        }

        let m = JSON.parse(message);

        if(m.S===1){
            if(this.initCallback){
                this.initCallback();
                this.initCallback = undefined;
            }
            return;
        }

        if(m.M && Array.isArray(m.M)){
            m.M.array.forEach((msg:any) => {
                if(this.onMessageReceived){
                    this.onMessageReceived(msg);
                }
            });
        };
    }
}
export class WebSocketTransport extends HttpBasedTransport implements ITransport{
     private websocket: WebSocket;
     private reconnectDelay: number = 2;

     supportKeepAlive:boolean = true;
     
    

     start():Promise<void>{
         var url = this.urlBuilder.buildConnectUrl(this.getName());
         url = url.replace(/^http/, "ws");
         return this.performConnect(url,false).then(()=>this.initReceived());
     }
     send(data:string):void{
         
     }
     getName():string{
         return "webSockets";
     }
     stop():void{

     }

     doReconnect(){

         let reconnectTimeoutHandler = setTimeout(()=>{
             if(this.connectionInfo.state == ConnectionState.disconnected){
                let url = this.urlBuilder.buildReconnectUrl(this.getName());
                this.performConnect(url,true).then(()=>{
                    if(this.connectionInfo.state == ConnectionState.reconnecting){
                        this.connectionInfo.state = ConnectionState.connected;
                        if(this.onReconnected){
                            this.onReconnected();
                        }
                    }
                });
             }
         },this.reconnectDelay * 1000);
         
     }

     private performConnect(url:string,isReconnect:boolean):Promise<void>{

         return new Promise<void>((reslove,reject)=>{
            let transport = this;
            let websocket = new WebSocket(url);
            var opened = false; 

            if(!isReconnect){
                this.initCallback = ()=>{ reslove();};
            }

            websocket.onopen = (event:Event)=>{
                transport.websocket = websocket;
                if(isReconnect){
                    reslove();
                }
            };

            websocket.onerror = (event:Event)=>{
                reject();
            };

            websocket.onmessage = (message:MessageEvent)=>{
                if(transport.onMessageReceived){
                    transport.processMessage(message.data);
                }
            };

            websocket.onclose = (event:CloseEvent)=>{
                if(transport && event.wasClean == false){
                    if(transport.onError){
                        transport.onError(new Error(`${event.reason}`));
                    }
                }

                if(transport){
                    if(transport.abortHandler.tryCompeleteAbort()){
                        return
                    }
                    if(transport.needConnect){
                        transport.needConnect();
                    }
                }

            }
         });
         
     }
}