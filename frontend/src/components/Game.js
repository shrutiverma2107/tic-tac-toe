import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const Game = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const ws = useRef(null);
  
  const [board, setBoard] = useState([['', '', ''], ['', '', ''], ['', '', '']]);
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [playerSymbol, setPlayerSymbol] = useState('');
  const [playersCount, setPlayersCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [gameUrl, setGameUrl] = useState('');

  useEffect(() => {
    const gameUrl = `${window.location.origin}/game/${roomId}`;
    setGameUrl(gameUrl);
    
    // Connect to WebSocket
    ws.current = new WebSocket(`ws://localhost:8000/ws/${roomId}`);
    
    ws.current.onopen = () => {
      setConnectionStatus('Connected');
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'player_joined':
          setPlayerSymbol(message.symbol);
          updateGameState(message.game_state);
          setConnectionStatus('Connected');
          break;
          
        case 'game_update':
        case 'game_reset':
          updateGameState(message.game_state);
          break;
          
        case 'player_left':
          updateGameState(message.game_state);
          setConnectionStatus('Player left');
          break;
          
        case 'error':
          alert(message.message);
          navigate('/');
          break;
          
        default:
          break;
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('Connection error');
    };

    ws.current.onclose = () => {
      setConnectionStatus('Disconnected');
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [roomId, navigate]);

  const updateGameState = (gameState) => {
    setBoard(gameState.board);
    setCurrentPlayer(gameState.current_player);
    setGameOver(gameState.game_over);
    setWinner(gameState.winner);
    setPlayersCount(gameState.players_count);
  };

  const makeMove = (row, col) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'move',
        row: row,
        col: col
      }));
    }
  };

  const resetGame = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'reset'
      }));
    }
  };

  const copyGameUrl = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl);
      alert('Game URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = gameUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Game URL copied to clipboard!');
    }
  };

  const getStatusMessage = () => {
    if (playersCount < 2) {
      return 'Waiting for another player to join...';
    }
    if (gameOver) {
      if (winner === 'Draw') {
        return "It's a draw!";
      }
      return `Player ${winner} wins!`;
    }
    if (currentPlayer === playerSymbol) {
      return 'Your turn';
    } else {
      return `Player ${currentPlayer}'s turn`;
    }
  };

  const canMakeMove = (row, col) => {
    return (
      !gameOver &&
      board[row][col] === '' &&
      currentPlayer === playerSymbol &&
      playersCount === 2 &&
      connectionStatus === 'Connected'
    );
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h1>Tic Tac Toe</h1>
        <div className="room-info">
          <p><strong>Room ID:</strong> {roomId}</p>
          <button onClick={copyGameUrl} className="copy-btn">
            📋 Copy Game Link
          </button>
        </div>
      </div>

      <div className="game-status">
        <p><strong>Status:</strong> {connectionStatus}</p>
        <p><strong>Players:</strong> {playersCount}/2</p>
        <p><strong>You are:</strong> Player {playerSymbol}</p>
        <p className="turn-indicator">{getStatusMessage()}</p>
      </div>

      <div className="game-board">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="board-row">
            {row.map((cell, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                className={`board-cell ${cell ? 'filled' : ''} ${
                  canMakeMove(rowIndex, colIndex) ? 'clickable' : ''
                }`}
                onClick={() => makeMove(rowIndex, colIndex)}
                disabled={!canMakeMove(rowIndex, colIndex)}
              >
                {cell}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="game-controls">
        <button onClick={resetGame} className="reset-btn">
          New Game
        </button>
        <button onClick={() => navigate('/')} className="home-btn">
          Back to Home
        </button>
      </div>

      {playersCount < 2 && (
        <div className="waiting-message">
          <p>Share this link with a friend to start playing:</p>
          <div className="url-container">
            <input 
              type="text" 
              value={gameUrl} 
              readOnly 
              className="url-input"
            />
            <button onClick={copyGameUrl} className="copy-btn">
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;