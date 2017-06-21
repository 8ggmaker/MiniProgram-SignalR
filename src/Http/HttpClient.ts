export interface IHttpClient {
    get(url:string,headers?:{[key:string]:string}):Promise<string>;
    post(url:string,data:string,headers?:{[key:string]:string}):Promise<string>;
}

export class HttpClient implements IHttpClient{
    get(url:string,headers?:{[key:string]:string}):Promise<string>{
        return this.send("GET", url, headers)
    }

    post(url:string,data:string,headers?:{[key:string]:string}):Promise<string>{
        return this.send("POST",url,headers,data)
    }
    

    private send(method:string,url:string,headers?:{[key:string]:string},data?:string):Promise<string>{
        return new Promise<string>((resolve,reject)=>{
            if(XMLHttpRequest){
                let xhr = new XMLHttpRequest();
                xhr.open(method,url,true);
                if(headers){
                    Object.keys(headers).forEach(key=>xhr.setRequestHeader(key,headers[key]));
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
            }else{
                wx.request({data:data,header:headers,method:method,url:url,fail:()=>{reject();},success:(res)=>{
                    if(res){
                        resolve(JSON.stringify(res.data));
                    }
                }});
            }
        });
    }

}