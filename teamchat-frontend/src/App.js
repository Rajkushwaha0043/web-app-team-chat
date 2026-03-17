import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './App.css';

const API_URL = 'http://localhost:5000/api';
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
  
  // Chat states
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentChannel, setCurrentChannel] = useState('general');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const messagesEndRef = useRef(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check login status
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

  // Connect to Socket.IO
  const connectSocket = (token, userData) => {
    socket = io('http://localhost:5000', {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('Connected to socket');
      socket.emit('authenticate', token);
    });

    socket.on('authenticated', (data) => {
      console.log('Socket authenticated');
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

  // Load sample messages
  const loadSampleMessages = () => {
    const sampleMsgs = [
      { id: 1, text: "Welcome to TeamChat! 👋", sender: "Admin", time: "10:00 AM", isYou: false },
      { id: 2, text: "This is a real-time chat app like WhatsApp", sender: "System", time: "10:01 AM", isYou: false },
      { id: 3, text: "You can send messages instantly", sender: "System", time: "10:02 AM", isYou: false },
      { id: 4, text: "Try typing a message below!", sender: "System", time: "10:03 AM", isYou: false }
    ];
    setMessages(sampleMsgs);
  };

  // Handle Login
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
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Use test@test.com / test123');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register
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
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Send Message
  const sendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: user.username,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      isYou: true
    };
    
    // Add to local messages
    setMessages(prev => [...prev, newMessage]);
    
    // Send via socket if connected
    if (socket) {
      socket.emit('send_message', {
        channelId: 'general',
        content: inputMessage
      });
    }
    
    // Clear input
    setInputMessage('');
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsLoggedIn(false);
    setMessages([]);
    setEmail('');
    setPassword('');
    setUsername('');
    
    if (socket) {
      socket.disconnect();
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // If logged in, show chat interface
  if (isLoggedIn && user) {
    return (
      <div className="app">
        {/* Header */}
        <div className="chat-header">
          <div className="header-left">
            <div className="user-avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2>TeamChat 💬</h2>
              <p>{onlineUsers.length} online • Last seen just now</p>
            </div>
          </div>
          <div className="header-right">
            <button className="icon-btn" title="Search">🔍</button>
            <button className="icon-btn" title="Menu">⋮</button>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="chat-container">
          {/* Messages */}
          <div className="messages-container">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`message ${msg.isYou ? 'sent' : 'received'}`}
              >
                {!msg.isYou && (
                  <div className="message-avatar">
                    {msg.sender.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="message-content">
                  {!msg.isYou && <div className="sender-name">{msg.sender}</div>}
                  <div className="message-bubble">
                    {msg.text}
                    <div className="message-time">{msg.time}</div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="input-container">
            <button className="icon-btn">😊</button>
            <button className="icon-btn">📎</button>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="message-input"
            />
            <button 
              onClick={sendMessage}
              className="send-btn"
              disabled={!inputMessage.trim()}
            >
              {inputMessage.trim() ? 'Send' : '🎤'}
            </button>
          </div>
        </div>

        {/* Online Users Sidebar */}
        <div className="online-sidebar">
          <h3>Online Users ({onlineUsers.length})</h3>
          <div className="online-list">
            <div className="online-user">
              <div className="status online"></div>
              <span>You ({user.username})</span>
            </div>
            {onlineUsers.filter(u => u !== user.username).map((user, idx) => (
              <div key={idx} className="online-user">
                <div className="status online"></div>
                <span>{user}</span>
              </div>
            ))}
            <div className="online-user">
              <div className="status offline"></div>
              <span>John</span>
            </div>
            <div className="online-user">
              <div className="status offline"></div>
              <span>Jane</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If not logged in, show auth page
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="app-logo">
            <div className="logo-icon">💬</div>
            <h1>TeamChat</h1>
            <p>Chat like WhatsApp with your team</p>
          </div>

          <div className="auth-tabs">
            <button 
              className={isLogin ? 'active' : ''}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>
            <button 
              className={!isLogin ? 'active' : ''}
              onClick={() => setIsLogin(false)}
            >
              Register
            </button>
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister}>
            {!isLogin && (
              <div className="input-group">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  required
                />
              </div>
            )}

            <div className="input-group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
              />
            </div>

            <div className="input-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
              />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button type="submit" disabled={loading} className="auth-button">
              {loading ? '...' : (isLogin ? 'Login' : 'Register')}
            </button>
          </form>

          <div className="demo-info">
            <p><strong>Test Account:</strong></p>
            <p>Email: test@test.com</p>
            <p>Password: test123</p>
          </div>

          <div className="auth-footer">
            <p>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <span onClick={() => setIsLogin(!isLogin)} className="toggle-link">
                {isLogin ? 'Register' : 'Login'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;