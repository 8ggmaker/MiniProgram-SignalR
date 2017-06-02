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
}
export class HubProxy{
    hubName:string;
    connection:HubConnection;
    state:{[key:string]:any};

    constructor(connection:HubConnection,hubName:string){
        this.connection = connection;
        this.hubName = hubName;
    }

    invoke(methodName:string,...args:any[]):Promise<any>{
        if(!methodName){
            throw new Error("invalid method name");
        }

        return new Promise((reslove,reject)=>{
            var callBack = (r:HubResult)=>{

            };

            var callbackId = this.connection.registerInvocationCallback(callBack);
        });
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

    onSending():string{
        let hubRegisterArray = new Array<HubRegistrationData>();
        this.hubNames.forEach(name=>hubRegisterArray.push(new HubRegistrationData(name)));
        return JSON.stringify(hubRegisterArray);
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

