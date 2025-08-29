from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import json
import uuid
import asyncio

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GameRoom:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.players: List[WebSocket] = []
        self.board = [["" for _ in range(3)] for _ in range(3)]
        self.current_player = "X"
        self.game_over = False
        self.winner = None
        self.player_symbols = {}  # websocket -> symbol mapping

    def add_player(self, websocket: WebSocket) -> bool:
        if len(self.players) < 2:
            self.players.append(websocket)
            symbol = "X" if len(self.players) == 1 else "O"
            self.player_symbols[websocket] = symbol
            return True
        return False

    def remove_player(self, websocket: WebSocket):
        if websocket in self.players:
            self.players.remove(websocket)
            if websocket in self.player_symbols:
                del self.player_symbols[websocket]

    def make_move(self, row: int, col: int, websocket: WebSocket) -> bool:
        if (self.game_over or 
            self.board[row][col] != "" or 
            websocket not in self.player_symbols or
            self.player_symbols[websocket] != self.current_player):
            return False

        self.board[row][col] = self.current_player
        
        if self.check_winner():
            self.game_over = True
            self.winner = self.current_player
        elif self.is_board_full():
            self.game_over = True
            self.winner = "Draw"
        else:
            self.current_player = "O" if self.current_player == "X" else "X"
        
        return True

    def check_winner(self) -> bool:
        # Check rows
        for row in self.board:
            if row[0] == row[1] == row[2] != "":
                return True
        
        # Check columns
        for col in range(3):
            if self.board[0][col] == self.board[1][col] == self.board[2][col] != "":
                return True
        
        # Check diagonals
        if self.board[0][0] == self.board[1][1] == self.board[2][2] != "":
            return True
        if self.board[0][2] == self.board[1][1] == self.board[2][0] != "":
            return True
        
        return False

    def is_board_full(self) -> bool:
        for row in self.board:
            for cell in row:
                if cell == "":
                    return False
        return True

    def reset_game(self):
        self.board = [["" for _ in range(3)] for _ in range(3)]
        self.current_player = "X"
        self.game_over = False
        self.winner = None

    def get_game_state(self):
        return {
            "board": self.board,
            "current_player": self.current_player,
            "game_over": self.game_over,
            "winner": self.winner,
            "players_count": len(self.players)
        }

# Store active game rooms
rooms: Dict[str, GameRoom] = {}

@app.get("/")
async def root():
    return {"message": "Tic Tac Toe Server"}

@app.get("/create-room")
async def create_room():
    room_id = str(uuid.uuid4())[:8]
    rooms[room_id] = GameRoom(room_id)
    return {"room_id": room_id}

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    
    # Create room if it doesn't exist
    if room_id not in rooms:
        rooms[room_id] = GameRoom(room_id)
    
    room = rooms[room_id]
    
    # Add player to room
    if not room.add_player(websocket):
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Room is full"
        }))
        await websocket.close()
        return
    
    # Send initial game state and player info
    player_symbol = room.player_symbols[websocket]
    await websocket.send_text(json.dumps({
        "type": "player_joined",
        "symbol": player_symbol,
        "game_state": room.get_game_state()
    }))
    
    # Notify other players
    for player in room.players:
        if player != websocket:
            await player.send_text(json.dumps({
                "type": "game_update",
                "game_state": room.get_game_state()
            }))
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "move":
                row, col = message["row"], message["col"]
                if room.make_move(row, col, websocket):
                    # Broadcast game state to all players
                    game_state = room.get_game_state()
                    for player in room.players:
                        await player.send_text(json.dumps({
                            "type": "game_update",
                            "game_state": game_state
                        }))
            
            elif message["type"] == "reset":
                room.reset_game()
                game_state = room.get_game_state()
                for player in room.players:
                    await player.send_text(json.dumps({
                        "type": "game_reset",
                        "game_state": game_state
                    }))
    
    except WebSocketDisconnect:
        room.remove_player(websocket)
        # Notify remaining players
        for player in room.players:
            await player.send_text(json.dumps({
                "type": "player_left",
                "game_state": room.get_game_state()
            }))
        
        # Clean up empty rooms
        if len(room.players) == 0:
            del rooms[room_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)