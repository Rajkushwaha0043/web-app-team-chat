import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './App.css';

// ✅ UPDATED: Use Render backend URL
const API_URL = 'https://web-app-team-chat.onrender.com/api';
const SOCKET_URL = 'https://web-app-team-chat.onrender.com';

let socket;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentChannel, setCurrentChannel] = useState('general');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check login
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setIsLoggedIn(true);
      connectSocket(token, parsedUser);
      loadSampleMessages();
    }
  }, []);

  // ✅ UPDATED SOCKET CONNECTION
  const connectSocket = (token, userData) => {
    socket = io(SOCKET_URL, {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('✅ Connected to socket');
      socket.emit('authenticate', token);
    });

    socket.on('authenticated', () => {
      socket.emit('join_channel', 'general');
    });

    socket.on('new_message', (message) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: message.content || message.text,
        sender: message.sender?.username || 'User',
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        isYou: message.sender?._id === userData?._id
      }]);
    });

    socket.on('user_online', (data) => {
      setOnlineUsers(prev => [...prev, data.username]);
    });

    socket.on('user_offline', (data) => {
      setOnlineUsers(prev => prev.filter(user => user !== data.username));
    });
  };

  const loadSampleMessages = () => {
    setMessages([
      { id: 1, text: "Welcome to TeamChat! 👋", sender: "Admin", time: "10:00 AM", isYou: false }
    ]);
  };

  // ✅ LOGIN
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password
      });
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setUser(response.data.user);
      setIsLoggedIn(true);
      connectSocket(response.data.token, response.data.user);
      loadSampleMessages();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ✅ REGISTER
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        username,
        email,
        password
      });
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setUser(response.data.user);
      setIsLoggedIn(true);
      connectSocket(response.data.token, response.data.user);
      loadSampleMessages();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // SEND MESSAGE
  const sendMessage = () => {
    if (!inputMessage.trim()) return;
    
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: inputMessage,
      sender: user.username,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      isYou: true
    }]);

    if (socket) {
      socket.emit('send_message', {
        channelId: 'general',
        content: inputMessage
      });
    }

    setInputMessage('');
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setIsLoggedIn(false);
    if (socket) socket.disconnect();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  // ================= UI =================

  if (isLoggedIn && user) {
    return (
      <div className="app">
        <h2>TeamChat 💬</h2>
        <button onClick={handleLogout}>Logout</button>

        <div>
          {messages.map(msg => (
            <div key={msg.id}>
              <b>{msg.sender}:</b> {msg.text}
            </div>
          ))}
        </div>

        <input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    );
  }

  return (
    <div>
      <h1>TeamChat</h1>

      <form onSubmit={isLogin ? handleLogin : handleRegister}>
        {!isLogin && (
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
          />
        )}

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />

        {error && <p style={{color:'red'}}>{error}</p>}

        <button type="submit">
          {isLogin ? 'Login' : 'Register'}
        </button>
      </form>

      <p onClick={() => setIsLogin(!isLogin)} style={{cursor:'pointer'}}>
        {isLogin ? 'Create account' : 'Login instead'}
      </p>
    </div>
  );
}

export default App;