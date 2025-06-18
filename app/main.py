from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import asyncio
import openai
import speech_recognition as sr

app = FastAPI()

html = """
<!DOCTYPE html>
<html lang='es'>
<head>
    <meta charset='UTF-8'>
    <title>Asistente de Ventas</title>
</head>
<body>
    <h1>Asistente de Ventas en Tiempo Real</h1>
    <button onclick="startCall()">Iniciar llamada</button>
    <ul id="sugerencias"></ul>
<script>
let ws;
function startCall() {
    ws = new WebSocket('ws://' + location.host + '/ws');
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const ul = document.getElementById('sugerencias');
        ul.innerHTML = '';
        data.options.forEach(opt => {
            const li = document.createElement('li');
            li.textContent = opt;
            ul.appendChild(li);
        });
    };
    navigator.mediaDevices.getUserMedia({audio:true}).then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0 && ws.readyState === 1) {
                ws.send(e.data);
            }
        };
        mediaRecorder.start(250);
    });
}
</script>
</body>
</html>
"""

@app.get('/')
async def get():
    return HTMLResponse(html)

recognizer = sr.Recognizer()
full_transcript = []

async def transcribe_audio(data: bytes) -> str:
    with sr.AudioFile(sr.io.BytesIO(data)) as source:
        audio = recognizer.record(source)
    return recognizer.recognize_google(audio, language='es-ES')

async def generate_suggestions(text: str) -> list:
    prompt = f"Sigue la conversación y sugiere dos respuestas en español para el vendedor:\n{text}\n"
    resp = openai.Completion.create(
        engine='text-davinci-003',
        prompt=prompt,
        max_tokens=60,
        n=2
    )
    return [c.text.strip() for c in resp.choices]

async def summarize_conversation(text: str) -> str:
    prompt = f"Resume la siguiente conversación resaltando puntos clave, objeciones y próximos pasos:\n{text}"
    resp = openai.Completion.create(
        engine='text-davinci-003',
        prompt=prompt,
        max_tokens=150,
        n=1
    )
    return resp.choices[0].text.strip()

@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    buffer = b''
    try:
        while True:
            data = await websocket.receive_bytes()
            buffer += data
            if len(buffer) > 16000 * 2:  # approx 1s of audio at 16kHz 16bit
                text = await transcribe_audio(buffer)
                full_transcript.append(text)
                options = await generate_suggestions(text)
                await websocket.send_json({"options": options})
                buffer = b''
    except WebSocketDisconnect:
        transcript = '\n'.join(full_transcript)
        summary = await summarize_conversation(transcript)
        await websocket.close()
        # In real app store summary or send to user

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('app.main:app', reload=True)
