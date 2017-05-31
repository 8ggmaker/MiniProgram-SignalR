import {NegotiateResponse} from "./Common"
import {Connection} from "./Connection"
export interface ITransport{
    negotiate(connection:Connection):Promise<NegotiateResponse>
    start():Promise<void>;
    send(data:any):Promise<any>;
    getName():string;
    supportKeepAlive:boolean;
    doReconnect():void;
    lostConnection():void;
}