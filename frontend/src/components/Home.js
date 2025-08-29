import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const createRoom = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('http://localhost:8000/create-room');
      const data = await response.json();
      navigate(`/game/${data.room_id}`);
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room. Make sure the server is running.');
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      navigate(`/game/${roomId}`);
    } else {
      alert('Please enter a room ID');
    }
  };

  return (
    <div className="home-container">
      <h1>Multiplayer Tic Tac Toe</h1>
      
      <div className="home-content">
        <div className="action-section">
          <h2>Create New Game</h2>
          <button 
            onClick={createRoom} 
            disabled={isCreating}
            className="create-btn"
          >
            {isCreating ? 'Creating...' : 'Create Room'}
          </button>
        </div>

        <div className="divider">OR</div>

        <div className="action-section">
          <h2>Join Existing Game</h2>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="room-input"
          />
          <button onClick={joinRoom} className="join-btn">
            Join Room
          </button>
        </div>
      </div>

      <div className="instructions">
        <h3>How to play:</h3>
        <ul>
          <li>Create a room and share the room ID with your friend</li>
          <li>Or join an existing room using the room ID</li>
          <li>First player is X, second player is O</li>
          <li>Take turns clicking on the board to make moves</li>
          <li>Get 3 in a row to win!</li>
        </ul>
      </div>
    </div>
  );
};

export default Home;