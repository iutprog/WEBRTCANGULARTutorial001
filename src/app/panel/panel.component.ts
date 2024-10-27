import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { MatGridListModule } from '@angular/material/grid-list';
import { DataService } from './service/data.service';

// Media constraits for the video and audio
const mediaConstraints = {
  audio: true,
  video: { width: 720, height: 540 },
}

//WebRTC offer option
const offerOptions = {
   offerToReceiveAudio: true,
   offerToReceiveVideo: true
}

// STUN and TURN servers configuration
const STUNServerConfiguration = {
   iceServers: [
     { urls: 'stun:stun.l.google.com:19302' },  // Public STUN server by Google
     {
       urls: 'turn:turn.anyfirewall.com:443?transport=tcp',  // TURN server for relaying media when STUN fails
       username: 'webrtc',
       credential: 'webrtc'
     }
   ]
 };



@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [MatGridListModule],
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.css'
})
export class PanelComponent implements AfterViewInit {
  

  @ViewChild('local_video') localVideo!:ElementRef;
  @ViewChild('remote_video') remoteVideo!:ElementRef


   private localStream!: MediaStream;
   private  peerConnection!: RTCPeerConnection ;
   private isCaller: boolean = false;

   constructor (private dataService: DataService ){}

  ngAfterViewInit(): void {
    this.addIncomingMessageHandler();
  }

  private async requestMediaDevices() : Promise<void>{
   this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints); // Access the camera and mic
   this.localVideo.nativeElement.srcObject = this.localStream ; // Display local stream in the video elt.
  }

   async startLocalVideo(): Promise <void>{
     if (!this.localStream) {
        await this.requestMediaDevices();  // Only request media devices if not already requested
      }
      this.localStream?.getVideoTracks().forEach( track => { track.enabled= true;});
      this.localVideo.nativeElement.srcObject = this.localStream; //  sEt the video lemet to display the stream
  }

  pauseLocalVideo():void{
     if (this.localStream) {
        this.localStream.getVideoTracks().forEach(track => track.enabled = false);  // Disable video tracks
        this.localVideo.nativeElement.srcObject = null //  sEt the video lemet to display the stream
     }
  }


 

    // create a new WebRTC peer connection
    private createPeerConnection(): void {

      this.peerConnection = new RTCPeerConnection(STUNServerConfiguration); // Initiallize the WebRTC connection

      this.peerConnection.onicecandidate = this.handleICECandidateEvent; // Wen ICE candidates are found, send them to remote user

      //When receiving the remote media track, display them in the remote video elt.
      this.peerConnection.ontrack = (event: RTCTrackEvent) => {
         console.log('Received remote track:', event.streams[0]);
         this.remoteVideo.nativeElement.srcObject = event.streams[0] // show remote video.
      }

      if(this.localStream){
         this.localStream.getTracks().forEach(track => this.peerConnection.addTrack(track, this.localStream))
      }
       
   }

     async call() : Promise<void>{
       console.log('Sending call-request ....');
       this.isCaller = true;
       this.dataService.sendMessage({type:'call-request', data:null});
    }
   private  closeVideoCall():void  {
      if(this.peerConnection){
         this.peerConnection.getTransceivers().forEach(transceiver =>  transceiver.stop());
         this.peerConnection.close();
         this.peerConnection = null!;
      }
       // Clear video elements
    this.localVideo.nativeElement.srcObject = null;
    this.remoteVideo.nativeElement.srcObject = null;
    this.isCaller = false;  // Reset the caller flag
   }
 

   private handleICECandidateEvent = (event : RTCPeerConnectionIceEvent) => {
      if(event.candidate){
         this.dataService.sendMessage({type:'ice-candidate', data:event.candidate}); 
      }
   }
    
   //list to incoming messages from signaling server
   addIncomingMessageHandler() {
        this.dataService.connect() ;
        this.dataService.message$.subscribe(msg => {
         console.log('Received message: ', msg);
         switch (msg.type){
            case 'call-request':
               this.addIncomingCallRequest();
               break;
            case 'call-accepted':
               if(this.isCaller){
                  this.startCall();
                  
               }
               break;  
            case 'call-rejected':
               if(this.isCaller){
                  alert (' The call was rejected by the remote user')
                  this.closeVideoCall();
               }
               break;

            case  'offer':
               if(!this.isCaller){
                  this.handleOfferMessage(msg.data);
               }
               break;
            case  'answer':
                  if(this.isCaller){
                     this.handleAnswerMessage(msg.data);
                  }
                  break;
            case 'ice-candidate': 
                this.handleICECandidateMessage(msg.data);
                break;
            case 'hangup':
               this.handleHangupMessage();
               break;
            default:
               console.log('Unknown message type' , msg.type);
         }
        })
   }

   private  addIncomingCallRequest(): void {
      if (this.isCaller) {
         // The caller should not receive the "Incoming call" prompt
         return;
       }
      const acceptCall = confirm('Incoming call. Do you want to accept it ?');
      if(acceptCall){
         console.log('Call accepted');
         this.createPeerConnection();
         this.dataService.sendMessage( { type:'call-accepted', data: null});

      } else {
        console.log('Calle rejeceted');
        this.dataService.sendMessage({type:'call-rejected', data:null});
      }
  }

  async startCall( ): Promise<void> {
   // Ensure local stream is available before starting the call
  this.createPeerConnection();  // Ensure that the peer conn is created.
  this.peerConnection.createOffer(offerOptions)
  .then(offer  =>  this.peerConnection.setLocalDescription(offer))//Set the local offer
  .then( () => { this.dataService.sendMessage({type:'offer', data: this.peerConnection.localDescription})}) //Send the offer
  .catch(this.handleGetUserMediaError) ;
}


private  handleOfferMessage(offer : RTCSessionDescriptionInit):void {
   //this.createPeerConnection();  // Ensure peerConnection is created here
    this.peerConnection.setRemoteDescription( new RTCSessionDescription(offer)) //Set remote offer
    .then(()=> this.peerConnection.createAnswer())
    .then( answer => this.peerConnection.setLocalDescription(answer))
    .then(() => { this.dataService.sendMessage({type:'answer', data: this.peerConnection.localDescription})})
     .catch(this.handleGetUserMediaError);
     
}


private handleAnswerMessage(answer: RTCSessionDescriptionInit): void {
   this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))  // Set remote answer
     .then(() => console.log('Remote description set successfully'))
     .catch(this.reportAnyError);
 }

 private  handleICECandidateMessage(data: RTCIceCandidateInit):void {
   this.peerConnection.addIceCandidate( new RTCIceCandidate(data)) // Set remote answer
   .then(() => { console.log('ICE candidate is added successfully')})
    .catch(this.reportAnyError);
}


   private handleHangupMessage(): void {
      this.closeVideoCall();
   }

   private handleGetUserMediaError(error: any) {
      console.error('Error accessing media devices: ', error);
      this.closeVideoCall();
   }
 
   // private  handleAnswerMessage(answer: RTCSessionDescriptionInit) {
   //    this.peerConnection.setRemoteDescription( new RTCSessionDescription(answer)) // Set remote answer
   //    .then(() => { console.log('Remote description is set successfully')})
   //     .catch(this.reportAnyError);


   // }
  
    
    
   private reportAnyError = (error: Error) =>{
      console.error('Error: ' , error.name , error.message);
   }


   hangUp(): void {
      this.dataService.sendMessage({type:'hangup', data:''});
      this.closeVideoCall();
   }
}

