import {Connection} from "./Connection"
export class HubProgressUpdate{
    //id
    I?:string;

    //data
    D?:any;
}

export class HubResult{
    //id
    I:string;

    //progress update
    P?:HubProgressUpdate;

    //result
    R?:any;

    //isHubException
    H?:boolean;

    //error
    E?:string;

    //error data
    D?:any;

    //state
    S?:{[key:string]:any}
}

export class HubRegistrationData{
    //hub name
    name:string;

    constructor(name:string){
        this.name = name;
    }
}

export class HubInvocation{
    //callback id
    I?:string;

    //hub name
    H:string;

    //method
    M:string;

    //args
    A?:Array<any>

    //state
    S?:{[key:string]:any}


    constructor(hubName:string,method:string,id?:string,args?:Array<any>,state?:{[key:string]:any}){
        this.H = hubName;
        this.M = method;
        this.I = id;
        this.A = args;
        this.S = state;
    }
}
export class HubProxy{
    hubName:string;
    connection:HubConnection;
    state:{[key:string]:any};
    subscriptions:{[key:string]:Function}

    constructor(connection:HubConnection,hubName:string){
        this.connection = connection;
        this.hubName = hubName;
    }

    //add progressupdate support ???
    invoke(methodName:string,...args:any[]):Promise<any>{
        if(!methodName){
            throw new Error("invalid method name");
        }

        return new Promise((reslove,reject)=>{
            var callBack = (r:HubResult)=>{
                if(r.E){
                    reject(new Error(r.E));//todo need to unify errors (err:string,data?:any)
                    return;
                }else{
                    if(r.S){
                        this.extendState(r.S);
                    }

                    if(r.R){
                        reslove(r.R);
                    }
                }
            };
            var callbackId = this.connection.registerInvocationCallback(callBack);

            var invocationData = new HubInvocation(this.hubName,methodName,callbackId,this.generateArgs(args),this.state);

            this.connection.send(invocationData).catch(()=>{
                reject();
            })
            
        });
    }

    on(eventName:string,func:Function){
        if(!eventName){
            throw new Error("invalid event name");
        }

        this.subscriptions = this.subscriptions || {};
        eventName = eventName.toLowerCase();
        var that = this;
        this.subscriptions[eventName] = function(data:any){
            func.apply(that,data);
        };
    }

    private extendState(state:{[key:string]:any}){
        this.state = this.state || {};
        if(state){
            Object.keys(state).forEach(key=>{this.state[key] = state[key];})
        }
    }

    private generateArgs(args:any[]):any[]{
        if(!args){
            return null;
        }

        args.forEach((val,index)=>{
            if(typeof val === 'undefined'){
                args[index] = null;
            }
        });

        return args;
    }
}

export class HubConnection extends Connection{
    callbackId:number = 0;
    hubs:{[key:string]:HubProxy};
    callbacks:{[key:string]:(r:HubResult)=>void};

    constructor(url:string,queryString?:Map<string,string>,userDefault?:boolean){
        super(HubConnection.getUrl(url,userDefault),queryString);
        this.hubs = {};
        this.callbacks = {};
        this.disconnected(this.clearInvocationCallbacks);
    }

    get hubNames():string[]{
        return Object.keys(this.hubs);
    }

    createHubProxy(hubName:string):HubProxy{
        if(!hubName){
            throw new Error("invalid hub name");
        }
        hubName = hubName.toLowerCase();
        var hub = new HubProxy(this,hubName);
        this.hubs = this.hubs || {};
        this.hubs[hubName] = hub;

        return hub;
    }

    registerInvocationCallback(callBack:(r:HubResult)=>void):string{
        if(!callBack){
            throw new Error("invalid callback method");
        }
        this.callbacks = this.callbacks || {};
        this.callbacks[this.callbackId.toString()] = callBack
        let resId = this.callbackId.toString();
        this.callbackId += 1;
        
        return resId;
    }

    clearInvocationCallbacks(error?:Error){
        let errorCallbacks = Array<(r:HubResult)=>void>()
        var callbackArray = Object.keys(this.callbacks).forEach(key=>{
            errorCallbacks.push(this.callbacks[key]);
            this.callbacks[key] = null;
        });
        this.callbacks = null;
        let hubRes = new HubResult();
        error = error || new Error("need clear invocation callbacks");
        hubRes.E = error.message;
        errorCallbacks.forEach(errorCallback=>errorCallback(hubRes))
    }

    onSending():string{
        let hubRegisterArray = new Array<HubRegistrationData>();
        this.hubNames.forEach(name=>hubRegisterArray.push(new HubRegistrationData(name)));
        return JSON.stringify(hubRegisterArray);
    }

    onMessageReceived(data:any){
        if(!data){
            return;
        }
        if(data.P){
            //todo
        }else if(data.I){
            let hubRes = data as HubResult;
            if(hubRes.I){
                let invokeCallback = this.callbacks[hubRes.I];
                this.callbacks[hubRes.I] = null;
                if(invokeCallback){
                    invokeCallback(hubRes);
                }
            }
        }else{
            let clientInvocationData = data as HubInvocation;
            let hubName = clientInvocationData.H.toLowerCase();
            let eventName = clientInvocationData.M.toLowerCase();

            if(this.hubs[hubName]){
                this.hubs[hubName].subscriptions[eventName](clientInvocationData.A);
            }
        }

        super.onMessageReceived(data);
    }

    static getUrl(url:string,useDefault?:boolean):string{
        if(!url){
            return;
        }
        if(!url.endsWith('/')){
           url = url.concat('/');
        }
        useDefault = useDefault || true;
        if(useDefault===true){
            return url.concat('signalr')
        }
    }
}

export {Connection} from "./Connection";
export {ITransport} from "./ITransport";

