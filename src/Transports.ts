import {Utils,NegotiateResponse,ConnectionInfo,ConnectionState} from "./Common"
import {UrlBuilder} from "./UrlBuilder"
import {ITransport} from "./ITransport"
import {IHttpClient,HttpClient} from "./Http/HttpClient"
import {TransportHelper,Connection} from "./Connection";

class TransportAbortHandler{
    private startAbort: boolean = false;
    private transportName: string;
    private urlBuilder:UrlBuilder;
    private httpClient:IHttpClient;

    constructor(transportName:string,urlBuilder:UrlBuilder,httpClient:IHttpClient){
        this.transportName = transportName;
        this.urlBuilder = urlBuilder;
        this.httpClient = httpClient;
    }

    tryCompeleteAbort():boolean{
        return this.startAbort;
    }

    compeleteAbort(){
        this.startAbort = true;
    }

    abort(timeout:number):Promise<void>{
        return new Promise<void>((reslove,reject)=>{
            if(this.startAbort === false){
                let abortTimeout = setTimeout(()=>{
                    this.compeleteAbort();
                    reslove();
                },timeout*1000);

                this.startAbort = true;
                let abortUrl = this.urlBuilder.buildAbortUrl(this.transportName);
                this.httpClient.get(abortUrl).then(()=>{
                    clearTimeout(abortTimeout);
                    reslove();
            }).catch(()=>{
                this.compeleteAbort();
                clearTimeout(abortTimeout);
                reslove();
            });
        }
        });
    }
}

class HttpBasedTransport{
    initCallback?: ()=>void;
    initErrorCallback?: ()=>void;

    httpClient: IHttpClient
    urlBuilder: UrlBuilder
    abortHandler:TransportAbortHandler;

    connection:Connection;

    getName():string{
        return '';
    }
    
    negotiate(connection:Connection):Promise<NegotiateResponse>{
        this.connection = connection;
        this.httpClient = new HttpClient();
        this.urlBuilder = new UrlBuilder(this.connection.connectionInfo);
        this.abortHandler = new TransportAbortHandler(this.getName(),this.urlBuilder,this.httpClient);

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

    processMessage(message:string):boolean{

        this.connection.markLastMessage();

        if(!message){
            return false;
        }

        var shouldReconnect = false;

        let m = JSON.parse(message);

        if(m.I){
            if(!this.connection.connectingMessageBuffer.tryBuffer(m)){
                this.connection.onMessageReceived(m);
            }
            return false;
        }

        if(m.T===1){
            shouldReconnect = true;
        }

        if(m.G){
            this.connection.connectionInfo.groupsToken = m.G;
        }

        if(m.M && Array.isArray(m.M)){
            m.M.forEach((msg:any) => {
                if(!this.connection.connectingMessageBuffer.tryBuffer(msg)){
                    this.connection.onMessageReceived(msg);
            }
            });
        }else{
            return shouldReconnect;
        }

        this.connection.connectionInfo.messageId = m.C;
        
        if(m.S===1){
            if(this.initCallback){
                this.initCallback();
                this.initCallback = null;
            }
        }
        
        return shouldReconnect;

    }

    abort(timeout:number):Promise<void>{
        return this.abortHandler.abort(timeout);
    }
}
export class WebSocketTransport extends HttpBasedTransport implements ITransport{
     private websocket: any;
     private reconnectDelay: number = 2;
     private reconnectTimeoutHandler: any;

     supportKeepAlive:boolean = true;

     start():Promise<void>{
         var url = this.urlBuilder.buildConnectUrl(this.getName());
         return this.performConnect(url,false).then(()=>this.initReceived());
     }

     send(data:any):Promise<any>{
         return new Promise((reslove,reject)=>{
            data = Utils.jsonSerialize(data);
            //need refactor to handle different environment
            if(WebSocket&&this.websocket instanceof WebSocket){
                try{
                    this.websocket.send(data);
                 }catch(err){
                     reject(err);
                     return;
                 }
            }
            else{
                wx.sendSocketMessage({data:data,fail:()=>{reject(new Error("senderror"));}});
            }
            reslove();
         });
     }

     getName():string{
         return "webSockets";
     }

     lostConnection():void{
         // need refactor to handle different environment
         if(WebSocket && this.websocket instanceof WebSocket){
             this.websocket.close();
             this.websocket = null;
         }else{
             wx.closeSocket();
         }

         if(this.abortHandler.tryCompeleteAbort()){
             return;
         }
         if(this.connection.connectionInfo.state == ConnectionState.disconnected){
             return;
         }

         this.doReconnect();
     }

     doReconnect(){
         //issue change while to if (may lead memory leak)
        while(!this.reconnectTimeoutHandler){
            this.reconnectTimeoutHandler = setTimeout(()=>{
                TransportHelper.verifyLastActive(this.connection).then(res=>{
                    if(res===true && this.connection.ensureReconnecting()){

                        let url = this.urlBuilder.buildReconnectUrl(this.getName());
                        this.performConnect(url,true).then(()=>{
                        clearTimeout(this.reconnectTimeoutHandler);
                        this.reconnectTimeoutHandler = null;
                        if(this.connection.changeState(ConnectionState.reconnecting,ConnectionState.connected)){
                            this.connection.onReconnected();
                        }
                    }).catch(()=>{clearTimeout(this.reconnectTimeoutHandler);this.reconnectTimeoutHandler = null;});
                }
            });
        }, this.reconnectDelay*1000);
    }
}

     private performConnect(url:string,isReconnect:boolean):Promise<void>{
         url = url.replace(/^http/, "ws");
         return new Promise<void>((reslove,reject)=>{

            let transport = this;
            var opened = false;

            let connectTimeoutHandler = setTimeout(()=>{
				if(!opened){
				    reject(new Error("time out to connect"));
				}
            },this.connection.connectionInfo.transportConnectTimeout * 1000);

            if(!isReconnect){
                this.initCallback = ()=>{ 
				opened = true;
				clearTimeout(connectTimeoutHandler); reslove();
				};
            }
            this.initErrorCallback = ()=>{clearTimeout(connectTimeoutHandler);reject();};
            // need refactor to handle different environment
            if(WebSocket){
                let websocket = new WebSocket(url);
                websocket.onopen = (event:Event)=>{
                    transport.websocket = websocket;
                    if(isReconnect){
                        reslove();
                    }
                };
                
                websocket.onerror = (event:Event)=>{
                    if(transport.initErrorCallback){
                        transport.initErrorCallback();
                        transport.initErrorCallback = null;
                    }else{
                        reject();
                    }
                };
                
                websocket.onmessage = (message:MessageEvent)=>{
                        transport.processMessage(message.data);
                };
                
                websocket.onclose = (event:CloseEvent)=>{
                    if(transport && event.wasClean === false){
                        transport.connection.onError(new Error(`${event.reason}`));
                    }
                    if(transport){
                        if(transport.abortHandler.tryCompeleteAbort()){
                            return
                        }
                        transport.doReconnect();
                    }
                }
            }else{
                wx.connectSocket({url:url});

                wx.onSocketOpen(function(res){
                    transport.websocket = wx;
                    if(isReconnect){
                        reslove()
                    }
                });

                wx.onSocketError(function(res){
                    if(transport.initErrorCallback){
                        transport.initErrorCallback();
                        transport.initErrorCallback = null;
                    }else{
                        reject();
                    }
                });

                wx.onSocketMessage(function(res){
                    if(res && typeof res.data === 'string'){
                            transport.processMessage(res.data);
                    }
                });

                wx.onSocketClose(function(res){
                    if(transport){
                        transport.connection.onError(new Error(`wx socket closed`));
                        if(transport.abortHandler.tryCompeleteAbort()){
                            return
                        }
                        transport.doReconnect();
                    }
                });

            }
         });
         
     }
}