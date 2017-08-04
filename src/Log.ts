export interface ILogger{
     trace(message?:any):void
     debug(message?:any):void
     info(message?:any):void
     warn(message?:any):void
     error(message?:any):void
}

export class ConsoleLogger implements ILogger{
    trace(message?:any):void{
        console.trace(message);
    }
    debug(message?:any):void{
        console.debug(message)
    }
    info(message?:any):void{
        console.info(message)
    }
    warn(message?:any):void{
        console.warn(message);
    }
    error(message?:any):void{
        console.error(message);
    }
}

export enum LogLevel{
    off = 0,
    trace = 1,
    debug = 2,
    info = 4,
    warn = 8,
    error = 16
}

export class Logger{
   private logger: ILogger;

   private logLevel: LogLevel;

   Logger(logger?:ILogger,logLevel?:LogLevel){
       this.logger = logger || new ConsoleLogger();
       this.logLevel = logLevel || LogLevel.error;
   }

   public trace(message?:any):void{
       if(this.shouldLogging(LogLevel.trace)){
           this.logger.trace(message);
       }
   }

   public debug(message?:any):void{
       if(this.shouldLogging(LogLevel.debug)){
           this.logger.debug(message);
       }
   }

   public info(message?:any):void{
       if(this.shouldLogging(LogLevel.info)){
           this.logger.info(message);
       }
   }

   public warn(message?:any):void{
       if(this.shouldLogging(LogLevel.warn)){
           this.logger.warn(message);
       }
   }

   public error(message?:any):void{
       if(this.shouldLogging(LogLevel.error)){
           this.logger.error(message);
       }
   }

   private shouldLogging(logLevel:LogLevel): boolean{
       return logLevel >= this.logLevel;
   }
   
}