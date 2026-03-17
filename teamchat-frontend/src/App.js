import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './App.css';

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
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const connectSocket = (token, userData) => {
    socket = io(SOCKET_URL, {
      auth: { token }
    });

    socket.on('connect', () => {
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
  };

  const loadSampleMessages = () => {
    setMessages([
      { id: 1, text: "Welcome to TeamChat! 👋", sender: "Admin", time: "10:00 AM", isYou: false }
    ]);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      setIsLoggedIn(true);
      connectSocket(res.data.token, res.data.user);
      loadSampleMessages();
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post(`${API_URL}/auth/register`, {
        username, email, password
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      setIsLoggedIn(true);
      connectSocket(res.data.token, res.data.user);
      loadSampleMessages();
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    setMessages(prev => [...prev, {
      id: Date.now(),
      text: inputMessage,
      sender: user.username,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      isYou: true
    }]);

    socket?.emit('send_message', {
      channelId: 'general',
      content: inputMessage
    });

    setInputMessage('');
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setIsLoggedIn(false);
    socket?.disconnect();
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

        <div className="chat-header">
          <div className="header-left">
            <div className="user-avatar">
              {user.username?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2>{user.username}</h2>
              <p>Online</p>
            </div>
          </div>

          <div className="header-right">
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="chat-container">
          <div className="messages-container">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.isYou ? 'sent' : 'received'}`}>
                
                {!msg.isYou && (
                  <div className="message-avatar">
                    {msg.sender.charAt(0)}
                  </div>
                )}

                <div className="message-content">
                  {!msg.isYou && (
                    <div className="sender-name">{msg.sender}</div>
                  )}

                  <div className="message-bubble">
                    {msg.text}
                    <div className="message-time">{msg.time}</div>
                  </div>
                </div>

              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-container">
            <input
              className="message-input"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
            />
            <button className="send-btn" onClick={sendMessage}>
              ➤
            </button>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">

          <div className="app-logo">
            <div className="logo-icon">💬</div>
            <h1>TeamChat</h1>
            <p>Chat like WhatsApp with your team</p>
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister}>

            {!isLogin && (
              <div className="input-group">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  required
                />
              </div>
            )}

            <div className="input-group">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
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
              />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button className="auth-button" type="submit">
              {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Register')}
            </button>

          </form>

          <div className="auth-footer">
            <p>
              {isLogin ? 'New user?' : 'Already have an account?'}{' '}
              <span className="toggle-link" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Create account' : 'Login'}
              </span>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;