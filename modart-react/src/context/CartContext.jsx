import { createContext, useContext, useEffect, useReducer } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const LS_KEY = 'modart_cart';

function cartReducer(state, action) {
  switch (action.type) {
    case 'SET':
      return action.items;
    case 'ADD': {
      const existing = state.find(i => i.productId === action.id && i.size === action.size);
      if (existing) return state.map(i =>
        i.productId === action.id && i.size === action.size ? { ...i, qty: i.qty + 1 } : i
      );
      return [...state, { productId: action.id, size: action.size, qty: 1 }];
    }
    case 'REMOVE':
      return state.filter(i => !(i.productId === action.id && i.size === action.size));
    case 'UPDATE_QTY':
      return state.map(i =>
        i.productId === action.id && i.size === action.size
          ? { ...i, qty: Math.max(1, i.qty + action.delta) }
          : i
      );
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, dispatch] = useReducer(cartReducer, [], () => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Persist to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  // Sync to Supabase when logged in
  useEffect(() => {
    if (!user) return;
    supabase.from('carts').upsert({
      user_id: user.id,
      items: JSON.stringify(items),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).catch(() => {});
  }, [items, user]);

  // Load from Supabase on login
  useEffect(() => {
    if (!user) return;
    supabase.from('carts').select('items').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data?.items) {
          const cloud = JSON.parse(data.items);
          if (Array.isArray(cloud) && cloud.length > 0) {
            dispatch({ type: 'SET', items: cloud });
          }
        }
      }).catch(() => {});
  }, [user]);

  const count    = items.reduce((s, i) => s + i.qty, 0);
  const add      = (id, size = 'M') => dispatch({ type: 'ADD', id, size });
  const remove   = (id, size)       => dispatch({ type: 'REMOVE', id, size });
  const updateQty = (id, size, delta) => dispatch({ type: 'UPDATE_QTY', id, size, delta });
  const clear    = ()               => dispatch({ type: 'CLEAR' });

  return (
    <CartContext.Provider value={{ items, count, add, remove, updateQty, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
