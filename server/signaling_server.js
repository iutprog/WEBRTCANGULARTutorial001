const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');

//load certif and key
const key = fs.readFileSync('localhost+1-key.pem');
const cert = fs.readFileSync('localhost+1.pem');

const httpsServer = https.createServer({key,cert});
const wss = new WebSocket.Server({server:httpsServer});

//Add CORS
wss.on('headers', (headers, req) => {
    headers.push('Access-Control-Allow-Origin: *');
    headers.push('Access-Control-Allow-Headers: Content-Type');
    headers.push('Access-Control-Allow-Methods: GET, POST');
});

wss.broadcast = (ws, data) => {
      wss.clients.forEach((client) => {
        if(client!==ws && client.readyState === WebSocket.OPEN){
            const jsonData = typeof data === 'string' ? data: JSON.stringify(data);
            client.send(jsonData)
        }

      });
}; 

wss.on('connection', (ws)=>{
    console.log(`Client connected. Total connected clients : ${wss.clients.size}`);

    ws.on('message', (message)=> {
        let receivedMessage = message;
        if(Buffer.isBuffer(message)){
            receivedMessage= message.toString();
        }else{
            receivedMessage = message;
        }
        console.log('Received message from client:' , receivedMessage);

        wss.broadcast(wss, receivedMessage);
    });

    ws.on('close', ()=> { console.log(`Client disconnected. Total connected clients: ${wss.clients.size}`)});

    ws.on('error', (error)=> { console.log(`Client disconnected. Total connected clients: ${wss.clients.size}`,error)});

});

//Start https server 
httpsServer.listen(8081, '0.0.0.0', () => { console.log('WebSocket signaling server is running on https://0.0.0.0:8081');});
