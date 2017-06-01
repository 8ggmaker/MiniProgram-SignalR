export declare type Started = ()=>void;
export declare type Reconnected = ()=>void;
export declare type Closed = ()=>void;
export declare type Exception = (e:Error)=>void;
export declare type Reconnecting = ()=>void;
export declare type ConnectionSlow = ()=>void;
export declare type Received = (data:any)=>void;
export declare type NeedReconnect = ()=>void;

export class Version{
    major: number = 0;
    minor: number = 0;
    build: number = 0;
    revison: number = 0;

    constructor(major:number,minor:number,build?:number,revsion?:number){
        if(!isInteger(major)||!isInteger(minor)||(build && !isInteger(build))){
            throw new Error(`parameters are not integer: major: ${major},minor:${minor},build:${build}`);
        }
        if(major<0||minor<0||(build && build<0)){
            throw new Error(`parameters are less than 0: major: ${major},minor:${minor},build:${build}`);
        }
        this.major = major;
        this.minor = minor;
        if(build){
            this.build = build;
        }
        if(revsion){
            this.revison = revsion;
        }
    }

    static parse(input:string):Version{
        let components = input.split('.');
        if(components.length < 2 || components.length > 4){
            throw new Error(`invalid input string: ${input}`);
        }
        let temp = new Version(0,0);
        components.forEach((val,idx)=>{
            switch(idx){
                case 0:
                    temp.major = parseInt(val);
                    break;
                case 1:
                    temp.minor = parseInt(val);
                    break;
                case 2:
                    temp.build = parseInt(val);
                    break;
                case 3: 
                    temp.revison = parseInt(val);
                    break;
                default:
                    break;
            }
        });
        return temp;
    }

    isEqual(version:Version):boolean{
        return version.major === this.major && version.minor === this.minor 
                && version.build === this.build && version.revison === this.revison;
    }

    toString():string{
        return `${this.major}.${this.minor}.${this.build}.${this.revison}`;
    }
}

export const PROTOCOL_VERSION = new Version(1,4);

export enum ConnectionState{
    connecting = 0,
    connected,
    reconnecting,
    disconnected,
}

export class ConnectionInfo{
    baseUrl:string;
    queryString?:string;
    headers?:Map<string,string>;
    connectionToken?:string;
    connectionData?:string;
    messageId?:string;
    groupsToken?:string;
    clientProtocol:Version = PROTOCOL_VERSION
    disconnectTimeout:number;
    transportConnectTimeout:number;
    reconnectWindow:number;
    lastActive:number;
    lastMessageAt:number;
    state: ConnectionState;


    constructor(baseUrl:string,lastActive:number,lastMessageAt:number,state:ConnectionState,queryString?:string,headers?:Map<string,string>,connectionToken?:string,
                connectionData?:string,messageId?:string,groupsToken?:string){
                    this.baseUrl = baseUrl;
                    this.lastActive = lastActive;
                    this.lastMessageAt = lastMessageAt;
                    this.state = state;
                    this.queryString = queryString;
                    this.headers = headers;
                    this.connectionToken = this.connectionToken;
                    this.connectionData = connectionData,
                    this.messageId = messageId;
                    this.groupsToken = groupsToken;
                }
}


export class NegotiateResponse{
    ConnectionId: string;
    ConnectionToken: string;
    Url: string;
    ProtocolVersion: string;
    DisconnectTimeout: number;
    TryWebSockets: boolean;
    KeepAliveTimeout?: number;
    TransportConnectTimeout: number
}

function isInteger(x:any) {
    return (typeof x === 'number') && (x % 1 === 0);
}

export class Utils{
    static jsonSerialize(data:any):string{
        if (typeof (data) === "string" || typeof (data) === "undefined" || data === null) {
            return data;
        }
        return JSON.stringify(data);
    }

    static events:
    {
        onStart: "onStart",
        onReceived: "onReceived",
        onConnectionSlow:"onConnectionSlow",
        onReconnecting:"onReconnecting",
        onReconnected:"onReconnected",
        onClose:"onClose",
        onError:"onError",
        [key:string]:string
    }
}