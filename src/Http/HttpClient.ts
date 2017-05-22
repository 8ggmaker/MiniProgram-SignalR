export interface IHttpClient {
    get(url:string,headers?:Map<string,string>):Promise<string>;
    post(url:string,data:string,headers?:Map<string,string>):Promise<string>;
}

export class HttpClient implements IHttpClient{
    get(url:string,headers?:Map<string,string>):Promise<string>{
        return this.send("GET", url, headers)
    }

    post(url:string,data:string,headers?:Map<string,string>):Promise<string>{
        return this.send("POST",url,headers,data)
    }
    

    private send(method:string,url:string,headers?:Map<string,string>,data?:string):Promise<string>{
        return new Promise<string>((resolve,reject)=>{
            let xhr = new XMLHttpRequest();

            xhr.open(method,url,true);
            
            if(headers){
                headers.forEach((val,key)=>xhr.setRequestHeader(key,val));
            }
            xhr.send(data)

            xhr.onload = ()=>{
                 if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr.response);
                }
                else {
                     reject({
                        status: xhr.status,
                        statusText: xhr.statusText
                    });
                }
            };

            xhr.onerror = ()=>{
                 reject({
                        status: xhr.status,
                        statusText: xhr.statusText
                    });
            };
        });
    }

}