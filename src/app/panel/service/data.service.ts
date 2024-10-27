import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Message } from '../types/message';

//export  const WS_ENDPOINT =  'wss://localhost:8081';
export  const WS_ENDPOINT =  'wss://192.168.1.113:8081';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private  socket$ : WebSocketSubject<any> | undefined ;
  private  messageSubject  = new Subject<Message>();
  public message$ = this.messageSubject.asObservable();
  private reconnectAttemps = 0;
  private readonly maxReconnectAttemps = 10;
  
  
  constructor() { }

   public connect() : void {
      this.socket$ = this.getNewWebSocket();

      this.socket$?.subscribe({
        //when a new msg is received
        next: (msg) =>{
           if( typeof  msg === 'string'){
                //Parse it as a json
                try {
                    const  parseMsg :  Message = JSON.parse(msg);
                    console.log('Parse message' , parseMsg);
                    this.messageSubject.next(parseMsg);
                }catch (error){
                  console.error('Error parsing Websocket message: ', msg, error);
                }
           } else {
             console.log('Received object message', msg);
             this.messageSubject.next(msg);
           }
        },
         // When ERROR
          error: (error) =>  console.error('Websocket Error : ' , error),
         // When closed
         complete: ()=> console.log('Websocket connection is closed')
        
      });

   }
   private getNewWebSocket(): WebSocketSubject<any> | undefined {
      return  webSocket( {
        url: WS_ENDPOINT,

        // Case 01 connection opened
        openObserver: {
           next: () => {
             console.log(' Data service : connection Open or OK');
             this.reconnectAttemps = 0;
           }
        },

        // Case 02 connection closed + reconnection logic
        closeObserver: {
          next: () => {
            console.log(' Data service : connection closed');
            this.socket$ = undefined;

            // Attemp to reconnect till max is reached.
            if(this.reconnectAttemps < this.maxReconnectAttemps){
              const reconnectDelay = Math.pow(2, this.maxReconnectAttemps) * 1000; //Exponential backoff
              console.log(` Reconnecting in ${reconnectDelay /1000} seconds...`);

              setTimeout(()=> {
                this.reconnectAttemps++;
                this.connect();

              }, reconnectDelay);

            } else {
              console.error('Max reconnect attemps reached. Giving up. :) ')
            }
          }
       }

      });
  }

   public sendMessage(msg:Message) : void{
    console.log(' Sending Message', msg.type);

    // Check if WS connecitn is open
     if(this.socket$){
       
        try {
            const serializeMsg = JSON.stringify(msg);
            console.log('Serialized message ', serializeMsg);
            this.socket$.next(serializeMsg);

        } catch (error){
           console.error('Error serializing the message' , msg, error);
        }

     } else {
      console.error(' Websocket connection is not open. Unable to send message'); 
     }

   }
}

