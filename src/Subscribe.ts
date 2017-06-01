export class Subscriber{
    eventName:string;
    worker:(data?:any)=>void;

    constructor(eventName:string,worker:(data?:any)=>void){
        this.eventName = eventName;
        this.worker = worker;
    }
}

export class EventBus{
    private eventStores:{[key:string]:Array<Subscriber>} = {};

    subscribe(subScriber:Subscriber){
        if(!subScriber.eventName){
            return;
        }

        let subscribers = this.eventStores[subScriber.eventName] || (this.eventStores[subScriber.eventName] = []);
        subscribers.push(subScriber);
    }

    publish(event:string,data?:any){
        let subscribers = this.eventStores[event];
        if(subscribers){
            subscribers.forEach(callback=>callback.worker(data));
        }
    }

}