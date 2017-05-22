export class KeepAliveData{
    private readonly keepAliveWarnAt: number = 2.0/3.0;
    timeout: number = 0;
    timeoutWarning: number = 0;
    checkInterval: number = 0;

    constructor(timeout: number){
        this.timeout = timeout;
        this.timeoutWarning = this.timeout * this.keepAliveWarnAt;
        this.checkInterval = this.timeout - this.timeoutWarning/3.0
    }

}