import WebSocket from "ws";

function processAudio(audioPayload) {
  return audioPayload;
}

const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", function connection(ws) {

  ws.on("message", function incoming(data) {

    const message = JSON.parse(data);

    if (message.event === "media") {

      const audioPayload = message.media.payload;

      processAudio(audioPayload);

    }

  });

});

console.log("Voice stream server running");
