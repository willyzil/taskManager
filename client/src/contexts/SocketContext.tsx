import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }

    // Disconnect any previous socket before creating a new one
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const s = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = s;
    s.on('connect', () => s.emit('join', user.id));
    
    if (mountedRef.current) {
      setSocket(s);
    }

    return () => {
      mountedRef.current = false;
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
