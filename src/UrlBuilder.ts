import {ConnectionInfo} from "./Common"

export class UrlBuilder{
    private connectionInfo:ConnectionInfo;

    constructor(connectionInfo:ConnectionInfo){
        this.connectionInfo = connectionInfo;
    }

    buildNegotiateUrl(transport:string):string{
        return UrlBuilder.trim(this.createBaseUrl('negotiate',transport));
    }

    buildConnectUrl(transport:string):string{
        var url = this.createBaseUrl('connect',transport);
        return UrlBuilder.trim(this.appendReceiveParameters(url));
    }

    buildStartUrl(transport:string):string{
        var url = this.createBaseUrl('start',transport);
        return UrlBuilder.trim(this.appendReceiveParameters(url));
    }

    buildReconnectUrl(transport:string):string{
        var url = this.createBaseUrl('reconnect',transport);
        return UrlBuilder.trim(this.appendReceiveParameters(url));
    }

    buildAbortUrl(transport:string):string{
        return UrlBuilder.trim(this.createBaseUrl('abort',transport));
    }

    private static trim(url:string):string{
        if(url.endsWith('&')){
            return url.slice(0,-1);
        }
        throw new Error("invalid url");
    }

    private createBaseUrl(command:string,transport:string):string{
        var url:string = `${this.connectionInfo.baseUrl}${command}?`;
        return this.appendCommandParameters(url,transport);    
    }

    private appendCommandParameters(url:string,transport:string):string{
        url = this.appendClientProtocol(url);
        url = this.appendTransport(url,transport);
        url = this.appendConnectionData(url);
        url = this.appendConnectionToken(url);
        url = this.appendCustomQueryString(url);
        return url;
    }

    private appendReceiveParameters(url:string):string{
        url = this.appendMessageId(url);
        url = this.appendGroupsToken(url);
        return url;
    }

    private appendClientProtocol(url:string):string{
        return `${url}clientProtocol=${this.connectionInfo.clientProtocol}&`;
    }

    private appendTransport(url:string,transport:string):string{
        return `${url}transport=${transport}&`;
    }

    private appendConnectionData(url:string):string{
        if(this.connectionInfo.connectionData){
            return `${url}connectionData=${encodeURIComponent(this.connectionInfo.connectionData)}&`;
        }
        return url;
    }

    private appendConnectionToken(url:string):string{
        if(this.connectionInfo.connectionToken){
            return `${url}connectionToken=${encodeURIComponent(this.connectionInfo.connectionToken)}&`;
        }
        return url;
    }

    private appendCustomQueryString(url:string):string{
        if(this.connectionInfo.queryString){
            var queryString:string = this.connectionInfo.queryString;
            if(queryString.startsWith('?')||queryString.startsWith('&')){
                queryString = this.connectionInfo.queryString.slice(1);
            }
            return `${url}${queryString}&`;
        }
        return url;
    }

    private appendMessageId(url:string):string{
        if(this.connectionInfo.messageId){
            return `${url}messageId=${this.connectionInfo.messageId}`;
        }
        return url;
    }

    private appendGroupsToken(url:string):string{
        if(this.connectionInfo.groupsToken){
            return `${url}groupsToken=${this.connectionInfo.groupsToken}`;
        }

        return url;
    }

}

